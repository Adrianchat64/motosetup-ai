(function(){
  // Model-year starts are sourced from manufacturer histories or launch announcements.
  // Ranges stop at the last year documented for each exact model name; custom entry remains available.
  const ranges={
    Honda:{
      "CRF250R":[2004,2027,"4-stroke"],"CRF250RWE":[2019,2026,"4-stroke"],
      "CRF450R":[2002,2027,"4-stroke"],"CRF450RWE":[2019,2026,"4-stroke"],
      "CRF250R HRC WORKS EDITION":[2027,2027,"4-stroke"],"CRF450R HRC WORKS EDITION":[2027,2027,"4-stroke"]
    },
    Kawasaki:{
      "KX65":[2000,2027,"2-stroke"],"KX85":[2001,2027,"2-stroke"],"KX112":[2022,2027,"2-stroke"],
      "KX250F":[2004,2020,"4-stroke"],"KX250":[2021,2026,"4-stroke"],
      "KX450F":[2006,2018,"4-stroke"],"KX450":[2019,2026,"4-stroke"]
    },
    Yamaha:{
      "YZ65":[2018,2027,"2-stroke"],"YZ85":[2002,2018,"2-stroke"],
      "YZ85 17/14":[2019,2027,"2-stroke"],"YZ85 19/16":[2019,2027,"2-stroke"],
      "YZ125":[1974,2027,"2-stroke"],"YZ250":[1974,2027,"2-stroke"],
      "YZ250F":[2001,2027,"4-stroke"],"YZ450F":[2003,2027,"4-stroke"]
    },
    Suzuki:{"RM-Z250":[2004,2026,"4-stroke"],"RM-Z450":[2005,2026,"4-stroke"]},
    KTM:{
      "50 SX":[2002,2027,"2-stroke"],"50 SX Factory Edition":[2026,2027,"2-stroke"],
      "65 SX":[1998,2027,"2-stroke"],"85 SX 17/14":[2003,2027,"2-stroke"],"85 SX 19/16":[2003,2027,"2-stroke"],
      "125 SX":[1998,2027,"2-stroke"],"250 SX":[1997,2027,"2-stroke"],"300 SX":[2023,2027,"2-stroke"],
      "250 SX-F":[2006,2027,"4-stroke"],"350 SX-F":[2011,2027,"4-stroke"],"450 SX-F":[2007,2027,"4-stroke"]
    },
    Husqvarna:{
      "TC 50":[2017,2027,"2-stroke"],"TC 65":[2017,2027,"2-stroke"],"TC 85 17/14":[2014,2027,"2-stroke"],"TC 85 19/16":[2014,2027,"2-stroke"],
      "TC 125":[2014,2027,"2-stroke"],"TC 250":[2014,2027,"2-stroke"],"TC 300":[2023,2027,"2-stroke"],
      "FC 250":[2014,2027,"4-stroke"],"FC 350":[2014,2027,"4-stroke"],"FC 450":[2014,2027,"4-stroke"],
      "FC 250 Factory Edition":[2027,2027,"4-stroke"],"FC 450 Factory Edition":[2027,2027,"4-stroke"]
    },
    GasGas:{
      "MC 50":[2021,2026,"2-stroke"],"MC 65":[2021,2026,"2-stroke"],"MC 85 17/14":[2021,2026,"2-stroke"],"MC 85 19/16":[2021,2026,"2-stroke"],
      "MC 125":[2021,2026,"2-stroke"],"MC 150":[2025,2026,"2-stroke"],"MC 250":[2021,2026,"2-stroke"],"MC 300":[2025,2026,"2-stroke"],
      "MC 250F":[2021,2026,"4-stroke"],"MC 350F":[2022,2026,"4-stroke"],"MC 450F":[2021,2026,"4-stroke"]
    },
    Triumph:{"TF 250-X":[2024,2027,"4-stroke"],"TF 450-RC":[2025,2025,"4-stroke"],"TF 450-X":[2026,2027,"4-stroke"]}
  };
  const catalog={};
  for(const [make,models] of Object.entries(ranges)) for(const [model,[first,last,engine]] of Object.entries(models)) {
    for(let year=first;year<=last;year++) (catalog[year]??={})[make]??={};
    for(let year=first;year<=last;year++) catalog[year][make][model]=engine;
  }
  // Kawasaki returned to the KX250F/KX450F names for 2027; the mini models continued too.
  catalog[2027]??={};
  catalog[2027].Kawasaki={"KX65":"2-stroke","KX85":"2-stroke","KX112":"2-stroke","KX250F":"4-stroke","KX450F":"4-stroke"};
  window.MotoBikeCatalog=Object.freeze(catalog);
})();
