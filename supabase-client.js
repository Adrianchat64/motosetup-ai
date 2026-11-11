(() => {
  const config = window.MOTOSETUP_SUPABASE_CONFIG || {};
  const statusNode = document.getElementById("accountStatus");
  const authButtons = ["registerButton", "loginButton", "resetEmailButton"]
    .map((id) => document.getElementById(id));
  const migrationPanel = document.getElementById("migrationPanel");
  let client = null;
  let clientPromise = null;
  let session = null;
  let activeUserId = "";
  let pendingAnonymousData = null;
  let realtimeChannel = null;
  let syncTimer = null;
  let busy = false;

  const sdkUrl = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0";
  const isLocalhost = (host) => host === "localhost" || host === "127.0.0.1";

  function publicKeyIsSafe(value) {
    if (typeof value !== "string" || value.length < 20) return false;
    if (value.startsWith("sb_secret_") || value.includes("service_role")) return false;
    if (value.startsWith("sb_publishable_")) return true;
    const parts = value.split(".");
    if (parts.length !== 3) return false;
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload.role === "anon";
    } catch {
      return false;
    }
  }

  function configIsSafe() {
    try {
      const url = new URL(config.url);
      const secureOrigin = url.protocol === "https:" || (url.protocol === "http:" && isLocalhost(url.hostname));
      return secureOrigin && publicKeyIsSafe(config.publishableKey);
    } catch {
      return false;
    }
  }

  const configured = configIsSafe();

  function setStatus(message, state = "info") {
    statusNode.textContent = message;
    statusNode.dataset.state = state;
  }

  function setBusy(nextBusy, label) {
    busy = nextBusy;
    [...authButtons,
      document.getElementById("syncNowButton"),
      document.getElementById("migrateDataButton"),
      document.getElementById("signOutButton"),
      document.getElementById("updatePasswordButton")]
      .filter(Boolean)
      .forEach((button) => { button.disabled = nextBusy || !configured || !navigator.onLine; });
    if (label) setStatus(label, "loading");
  }

  function setAccountVisible(isSignedIn) {
    document.getElementById("authPanel").classList.remove("hidden");
    document.getElementById("signedInPanel").classList.toggle("hidden", !isSignedIn);
  }

  function setMigrationVisible() {
    if (!activeUserId || !pendingAnonymousData) {
      migrationPanel.classList.add("hidden");
      return;
    }
    const bikeCount = pendingAnonymousData.bikes.length;
    const riderCount = pendingAnonymousData.riders.length;
    if (bikeCount + riderCount === 0) {
      migrationPanel.classList.add("hidden");
      return;
    }

    document.getElementById("migrationSummary").textContent =
      `This browser has ${riderCount} rider profile${riderCount === 1 ? "" : "s"} and ${bikeCount} bike${bikeCount === 1 ? "" : "s"}. Copying adds missing records to your account and keeps the original browser copy.`;
    const choice = document.getElementById("migrationRiderChoice");
    const label = document.getElementById("migrationRiderLabel");
    choice.replaceChildren();
    if (riderCount > 1) {
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "Do not copy a rider profile";
      choice.append(none);
      pendingAnonymousData.riders.forEach((rider) => {
        const option = document.createElement("option");
        option.value = rider.id;
        option.textContent = rider.name || "Unnamed rider";
        choice.append(option);
      });
      choice.classList.remove("hidden");
      label.classList.remove("hidden");
    } else {
      choice.classList.add("hidden");
      label.classList.add("hidden");
    }
    migrationPanel.classList.remove("hidden");
  }

  function loadSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (clientPromise) return clientPromise;
    clientPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = sdkUrl;
      script.async = true;
      script.onload = () => window.supabase?.createClient
        ? resolve(window.supabase)
        : reject(new Error("The Supabase library did not initialize."));
      script.onerror = () => reject(new Error("Could not load the account service. Check your connection."));
      document.head.append(script);
    }).catch((error) => {
      clientPromise = null;
      throw error;
    });
    return clientPromise;
  }

  async function getClient() {
    if (!configured) throw new Error("Cloud accounts are not configured. Account access needs a Supabase project connection.");
    if (client) return client;
    const sdk = await loadSdk();
    client = sdk.createClient(config.url, config.publishableKey, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    client.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        document.getElementById("passwordUpdatePanel").classList.remove("hidden");
        setStatus("Choose a new password to finish resetting your account.");
      }
      if (event !== "INITIAL_SESSION") setTimeout(() => { void acceptSession(nextSession); }, 0);
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    await acceptSession(data.session);
    return client;
  }

  function toLocalRider(row) {
    return {
      id: row.client_id,
      name: row.name,
      weight: row.weight_gear_lb == null ? "" : String(row.weight_gear_lb),
      height: row.height || "",
      level: row.experience_level || "C class",
      style: row.riding_style || "Motocross",
      notes: row.preferences || "",
      updatedAt: row.updated_at
    };
  }

  function toLocalBike(row) {
    return {
      id: row.client_id,
      make: row.make,
      year: row.model_year == null ? "" : String(row.model_year),
      model: row.model,
      engine: row.engine_type,
      hours: row.engine_hours == null ? "0" : String(row.engine_hours),
      notes: row.notes || row.modifications || "",
      updatedAt: row.updated_at
    };
  }

  function rowForRider(rider, userId) {
    return {
      user_id: userId,
      client_id: String(rider.id),
      name: rider.name,
      weight_gear_lb: rider.weight === "" || rider.weight == null ? null : Number(rider.weight),
      height: rider.height || null,
      experience_level: rider.level || null,
      riding_style: rider.style || null,
      preferences: rider.notes || null,
      updated_at: rider.updatedAt || new Date().toISOString()
    };
  }

  function rowForBike(bike, userId) {
    return {
      user_id: userId,
      client_id: String(bike.id),
      make: bike.make,
      model: bike.model,
      model_year: bike.year ? Number(bike.year) : null,
      engine_type: bike.engine,
      engine_hours: bike.hours ? Number(bike.hours) : 0,
      modifications: bike.notes || null,
      notes: bike.notes || null,
      updated_at: bike.updatedAt || new Date().toISOString()
    };
  }

  function mergeRows(localRows, cloudRows, toLocal) {
    const cloud = new Map(cloudRows.map((row) => [row.client_id, toLocal(row)]));
    const upload = [];
    for (const local of localRows) {
      const remote = cloud.get(String(local.id));
      const localTime = Date.parse(local.updatedAt || "") || 0;
      const remoteTime = Date.parse(remote?.updatedAt || "") || 0;
      if (!remote || localTime > remoteTime) {
        cloud.set(String(local.id), local);
        upload.push(local);
      }
    }
    return { merged: [...cloud.values()], upload };
  }

  async function uploadRows(table, rows, toRow) {
    for (const row of rows) {
      const { error } = await client.from(table).upsert(toRow(row, activeUserId), {
        onConflict: "user_id,client_id"
      });
      if (error) throw error;
    }
  }

  async function applyTombstones() {
    const tombstones = window.MotoSetupStore.getTombstones();
    for (const [kind, table] of [["riders", "rider_profiles"], ["bikes", "bikes"]]) {
      const items = tombstones[kind];
      const removed = [];
      for (const item of items) {
        const { error } = await client.from(table).update({deleted_at:item.deletedAt || new Date().toISOString()})
          .eq("user_id", activeUserId)
          .eq("client_id", String(item.id));
        if (error) throw error;
        removed.push(String(item.id));
      }
      if (removed.length) window.MotoSetupStore.clearTombstones(kind === "riders" ? "rider" : "bike", removed);
    }
  }

  async function syncAccount({ quiet = false } = {}) {
    if (!activeUserId || !navigator.onLine) {
      if (!navigator.onLine) setStatus("Offline. This account's local cache is available; queued rider and bike changes will sync when online.", "offline");
      return;
    }
    try {
      const accountResult = await client.from("accounts").select("plan").eq("id", activeUserId).single();
      if (accountResult.error) throw accountResult.error;
      const plan = accountResult.data.plan === "premium" ? "premium" : "free";
      window.MotoSetupStore.setAccountPlan(plan);
      document.getElementById("accountPlanLabel").textContent = plan === "premium" ? "Premium · Unlimited riders" : "Free · 1 rider profile";

      await applyTombstones();
      const [riderResult, bikeResult] = await Promise.all([
        client.from("rider_profiles").select("client_id,name,weight_gear_lb,height,experience_level,riding_style,preferences,updated_at,deleted_at"),
        client.from("bikes").select("client_id,make,model,model_year,engine_type,engine_hours,modifications,notes,updated_at,deleted_at")
      ]);
      if (riderResult.error) throw riderResult.error;
      if (bikeResult.error) throw bikeResult.error;

      const local = window.MotoSetupStore.getLocalData();
      const deletedRiderIds = new Set(riderResult.data.filter((row) => row.deleted_at).map((row) => row.client_id));
      const deletedBikeIds = new Set(bikeResult.data.filter((row) => row.deleted_at).map((row) => row.client_id));
      const riderMerge = mergeRows(local.riders.filter((row) => !deletedRiderIds.has(String(row.id))), riderResult.data.filter((row) => !row.deleted_at), toLocalRider);
      const bikeMerge = mergeRows(local.bikes.filter((row) => !deletedBikeIds.has(String(row.id))), bikeResult.data.filter((row) => !row.deleted_at), toLocalBike);
      let profileLimitError = false;
      try {
        await uploadRows("rider_profiles", riderMerge.upload, rowForRider);
      } catch (error) {
        if (String(error.message || "").includes("free_plan_rider_limit")) profileLimitError = true;
        else throw error;
      }
      await uploadRows("bikes", bikeMerge.upload, rowForBike);
      window.MotoSetupStore.replaceCloudData({riders:riderMerge.merged,bikes:bikeMerge.merged});

      if (profileLimitError) {
        setStatus("Some local rider profiles remain on this device because the server enforces the Free one-profile limit. No local records were removed.", "warning");
      } else if (!quiet) {
        setStatus("Rider profiles and bikes are synced. Setup, maintenance, and gearing sync are the next data step.", "success");
      }
    } catch (error) {
      setStatus(navigator.onLine
        ? "Cloud sync could not finish. Your local records are still saved; try Sync Now again."
        : "Offline. Your local records are still saved and will sync when online.", "error");
    }
  }

  async function refreshAccount() {
    if (!navigator.onLine) {
      setStatus("Offline. Connect to the internet to create an account or log in.", "offline");
      return;
    }
    await syncAccount({quiet:true});
    setMigrationVisible();
  }

  async function acceptSession(nextSession) {
    session = nextSession;
    const nextUserId = nextSession?.user?.id || "";
    if (nextUserId !== activeUserId) {
      if (nextUserId) pendingAnonymousData = window.MotoSetupStore.setAccountScope(nextUserId);
      activeUserId = nextUserId;
    }
    const signedIn = Boolean(nextSession?.user);
    setAccountVisible(signedIn);
    if (signedIn) {
      document.body.classList.remove("signed-out");
      document.getElementById("accountEmailLabel").textContent = nextSession.user.email || "Signed in";
      await refreshAccount();
      attachRealtime();
    } else {
      document.body.classList.add("signed-out");
      window.MotoSetupStore.clearAccountData();
      detachRealtime();
      setMigrationVisible();
      if (configured) setStatus("Not signed in. Your existing local data is unchanged.");
    }
  }

  function attachRealtime() {
    if (!client || !activeUserId || realtimeChannel) return;
    realtimeChannel = client.channel(`motosetup-account-${activeUserId}`)
      .on("postgres_changes", {event:"*", schema:"public", table:"rider_profiles", filter:`user_id=eq.${activeUserId}`}, () => queueSync(800))
      .on("postgres_changes", {event:"*", schema:"public", table:"bikes", filter:`user_id=eq.${activeUserId}`}, () => queueSync(800))
      .subscribe();
  }

  function detachRealtime() {
    if (client && realtimeChannel) void client.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  function queueSync(delay = 1200) {
    if (!activeUserId || !client) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { void syncAccount({quiet:true}); }, delay);
  }

  async function register() {
    const email = document.getElementById("accountEmail").value.trim();
    const password = document.getElementById("accountPassword").value;
    const displayName = document.getElementById("accountDisplayName").value.trim();
    if (!email || password.length < 8) return setStatus("Enter a valid email and a password with at least 8 characters.", "error");
    setBusy(true, "Creating your Free account…");
    try {
      const auth = await getClient();
      const {data, error} = await auth.auth.signUp({
        email, password,
        options: {data:{display_name:displayName}, emailRedirectTo:window.location.href.split("#")[0]}
      });
      if (error) throw error;
      if (data.session) setStatus("Account created. Your browser data is still preserved; review the copy option below.", "success");
      else setStatus("If registration is available for this email, check your inbox to confirm the account.", "success");
    } catch {
      setStatus("Could not create the account. Check the email, try signing in, or review the cloud connection.", "error");
    } finally { setBusy(false); }
  }

  async function login() {
    const email = document.getElementById("accountEmail").value.trim();
    const password = document.getElementById("accountPassword").value;
    if (!email || !password) return setStatus("Enter your email and password.", "error");
    setBusy(true, "Signing in securely…");
    try {
      const auth = await getClient();
      const {error} = await auth.auth.signInWithPassword({email,password});
      if (error) throw error;
      setStatus("Signed in. Loading your account data…", "success");
    } catch {
      setStatus("Sign-in failed. Check your details and connection, then try again.", "error");
    } finally { setBusy(false); }
  }

  async function sendPasswordReset() {
    const email = document.getElementById("accountEmail").value.trim();
    if (!email) return setStatus("Enter the email address for the account.", "error");
    if (window.location.origin === "null") return setStatus("Open MotoSetup from a local web address or your site before requesting a reset email.", "error");
    setBusy(true, "Requesting a password reset…");
    try {
      const auth = await getClient();
      const redirectTo = `${window.location.origin}${window.location.pathname}?password-reset=1`;
      const {error} = await auth.auth.resetPasswordForEmail(email,{redirectTo});
      if (error) throw error;
      setStatus("If an account uses that address, a password reset email will arrive shortly.", "success");
    } catch {
      setStatus("The reset request could not be sent. Check the connection and email setup, then try again.", "error");
    } finally { setBusy(false); }
  }

  async function updatePassword() {
    const password = document.getElementById("newPassword").value;
    if (password.length < 8) return setStatus("Choose a password with at least 8 characters.", "error");
    setBusy(true, "Updating your password…");
    try {
      const auth = await getClient();
      const {error} = await auth.auth.updateUser({password});
      if (error) throw error;
      document.getElementById("newPassword").value = "";
      document.getElementById("passwordUpdatePanel").classList.add("hidden");
      setStatus("Password updated.", "success");
    } catch {
      setStatus("The password could not be updated. Reopen the latest reset email and try again.", "error");
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true, "Signing out…");
    try {
      const auth = await getClient();
      const {error} = await auth.auth.signOut();
      if (error) throw error;
      await acceptSession(null);
      setStatus("Signed out. Log in again to open your saved account data.", "success");
    } catch {
      setStatus("Sign-out could not complete. Check your connection and try again.", "error");
    } finally { setBusy(false); }
  }

  async function migrateLocalData() {
    if (!pendingAnonymousData || !activeUserId) return;
    setBusy(true, "Copying local records without removing the originals…");
    try {
      const currentRiders = await client.from("rider_profiles").select("client_id,deleted_at");
      const currentBikes = await client.from("bikes").select("client_id,deleted_at");
      if (currentRiders.error) throw currentRiders.error;
      if (currentBikes.error) throw currentBikes.error;
      const riderIds = new Set(currentRiders.data.map((row) => row.client_id));
      const bikeIds = new Set(currentBikes.data.map((row) => row.client_id));
      const freeSlots = accountPlan === "premium" ? Infinity : Math.max(0, 1 - currentRiders.data.filter((row) => !row.deleted_at).length);
      const selectedId = document.getElementById("migrationRiderChoice").value;
      const candidates = accountPlan === "premium" || pendingAnonymousData.riders.length <= 1
        ? pendingAnonymousData.riders
        : pendingAnonymousData.riders.filter((rider) => rider.id === selectedId);
      let ridersAdded = 0;
      let bikesAdded = 0;

      for (const rider of candidates) {
        if (riderIds.has(String(rider.id)) || ridersAdded >= freeSlots) continue;
        await uploadRows("rider_profiles", [rider], rowForRider);
        riderIds.add(String(rider.id));
        ridersAdded++;
      }
      for (const bike of pendingAnonymousData.bikes) {
        if (bikeIds.has(String(bike.id))) continue;
        await uploadRows("bikes", [bike], rowForBike);
        bikeIds.add(String(bike.id));
        bikesAdded++;
      }
      await syncAccount({quiet:true});
      const skippedRiders = pendingAnonymousData.riders.length - ridersAdded;
      setStatus(`Copied ${ridersAdded} rider profile${ridersAdded === 1 ? "" : "s"} and ${bikesAdded} bike${bikesAdded === 1 ? "" : "s"}. The original local records were kept${skippedRiders ? `; ${skippedRiders} rider profile${skippedRiders === 1 ? " remains" : "s remain"} local due to account limits or existing cloud records` : ""}.`, "success");
      pendingAnonymousData = null;
      migrationPanel.classList.add("hidden");
    } catch {
      setStatus("The copy did not finish. Local records were not removed; retry the copy or download a browser backup first.", "error");
    } finally { setBusy(false); }
  }

  document.getElementById("registerButton").addEventListener("click", register);
  document.getElementById("loginButton").addEventListener("click", login);
  document.getElementById("resetEmailButton").addEventListener("click", sendPasswordReset);
  document.getElementById("updatePasswordButton").addEventListener("click", updatePassword);
  document.getElementById("signOutButton").addEventListener("click", signOut);
  document.getElementById("syncNowButton").addEventListener("click", () => { setBusy(true,"Syncing rider profiles and bikes…"); void syncAccount().finally(() => setBusy(false)); });
  document.getElementById("migrateDataButton").addEventListener("click", migrateLocalData);

  window.addEventListener("offline", () => {
    authButtons.forEach((button) => { button.disabled = true; });
    setStatus("Offline. Local records are available; rider and bike changes will sync when online.", "offline");
  });
  window.addEventListener("online", () => {
    authButtons.forEach((button) => { button.disabled = !configured; });
    if (activeUserId) { setStatus("Connection restored. Syncing…", "loading"); queueSync(50); }
    else if (!configured) setStatus("Cloud accounts are not configured. Local mode remains available.", "offline");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && activeUserId) queueSync(50);
  });

  if (!configured) {
    authButtons.forEach((button) => { button.disabled = true; });
    setStatus("Cloud is not configured yet. Add the Supabase project URL and public publishable/anon key in supabase-config.js. Local features remain available.", "offline");
  } else if (!navigator.onLine) {
    authButtons.forEach((button) => { button.disabled = true; });
    setStatus("Offline. Connect to the internet to create an account or log in.", "offline");
  } else {
    setStatus("Cloud is configured. Sign in or create a Free account.");
    void getClient().catch(() => setStatus("Cloud is unavailable right now. Check the connection and try again.", "offline"));
  }

  window.MotoSetupCloud = {queueSync};
})();
