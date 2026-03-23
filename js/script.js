/**
 * Helper function to select elements.
 * Pass a parent element to scope the search, otherwise it defaults to the whole document.
 */
const select = (selector, parent = document) => parent.querySelector(selector);

async function init() {
  const urlParams = new URLSearchParams(window.location.search);

  const profile = await getProfile(urlParams);
  if (!profile) {
    return;
  }

  const webhookUrl = getWebhookUrl(urlParams);

  try {
    const [tags, traits, powers] = await Promise.all([
      fetch("./js/tags.json").then((res) => res.json()),
      fetch("./js/traits.json").then((res) => res.json()),
      fetch("./js/powers.json").then((res) => res.json()),
    ]);
    buildCharacterSheet(profile, tags, traits, powers, webhookUrl);
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

function buildCharacterSheet(profile, tagsData, traitsData, powersData, webhookUrl) {
  select("#character-name").textContent = profile.name;
  select("#secret-identity").textContent = profile.secretIdentity;
  select("#character-photo").src = profile.photoUrl;

  select(".value", select("#stat-rank")).textContent = profile.rank;

  const getStoredStat = (statName, maxVal) => {
    const stored = localStorage.getItem(`${profile.name}_${statName}`);
    return stored !== null ? parseInt(stored, 10) : maxVal;
  };

  const setupStatCard = (cardSelector, statName, maxVal) => {
    const card = select(cardSelector);
    let currentVal = getStoredStat(statName, maxVal);

    select(".value", card).textContent = `${currentVal} / ${maxVal}`;
    card.classList.add("clickable");

    card.addEventListener("click", () => {
      showPopUp({
        content: `Update ${statName.toUpperCase()}`,
        isNumberInputVisible: true,
        numberLabelText: `New Value (Max: ${maxVal}):`,
        isPrimaryVisible: true,
        primaryText: "Save",
        isSecondaryVisible: true,
        secondaryText: "Cancel",
        onPrimaryClick: (newValue) => {
          const finalValue = newValue; // no min or max needed

          localStorage.setItem(`${profile.name}_${statName}`, finalValue);

          select(".value", card).textContent = `${finalValue} / ${maxVal}`;
        },
      });

      select("#inp-number").value = currentVal;
    });
  };

  setupStatCard("#stat-health", "Health", profile.health);
  setupStatCard("#stat-focus", "Focus", profile.focus);
  setupStatCard("#stat-karma", "Karma", profile.karma);

  select(".value", select("#stat-init")).textContent = buildInitiative(profile.initiative);

  document.body.className = profile.theme;

  renderSimpleGrid(profile.traits, traitsData, "#traits-grid", ["trait-label", "trait-value"], "Trait");
  renderSimpleGrid(profile.tags, tagsData, "#tags-grid", ["tag-label", "tag-value"], "Tag");

  renderAbilities(profile, webhookUrl);
  renderDamages(profile, webhookUrl);
  renderPowers(profile.powers, powersData);

  select("#btn-delete-webhook").addEventListener("click", () => {
    if (confirm("Delete the webhook URL? This cannot be undone!!")) {
      localStorage.removeItem("webhookUrl");
    }
  });

  select("#dice-btn-close-dice").addEventListener("click", () => {
    const diceContainer = select("#dice-container");
    diceContainer.classList.add("hidden");
    select("#die1", diceContainer).textContent = "";
    select("#die2", diceContainer).textContent = "";
    select("#die3", diceContainer).textContent = "";
    select("#dice-damage-row", diceContainer).classList.add("hidden");

    select("#dice-ability-bonus", diceContainer).textContent = "";
  });

  select("#btn-close-details").addEventListener("click", () => {
    select("#details-container").classList.add("hidden");
  });

  select("#stat-init").addEventListener("click", () => {
    rollInitiative(profile, webhookUrl);
  });
}

function buildInitiative(initiative) {
  return `${initiative.value > 0 ? "+" : ""}${initiative.value}${initiative.edge ? "E" : ""}`;
}

function buildRollMessage({ roll, isReroll, abilityType, characterName, color, thumbnailUrl, isInit, hasEdge }) {
  const dieEmoji1 = getDieEmoji(roll.dieResult1);
  const dieEmoji2 = getDieEmoji(roll.isFantastic ? 7 : roll.marvelDieResult);
  const dieEmoji3 = getDieEmoji(roll.dieResult3);

  const damageString = roll.hasDamage ? ` Damage ${roll.damage}.` : "";
  const rerollPrefix = isReroll ? "**[REROLL]** " : "";
  const contentString = `${rerollPrefix}${characterName} rolled ${abilityType}${roll.hasDamage ? " Attack" : ""}.\nResult ${roll.result}.${damageString}`;

  const fields = [
    {
      name: "Result",
      value: `**${roll.result}**`,
    },
  ];

  if (roll.hasDamage) {
    const damageBonusString = `${roll.damageAbilityScore >= 0 ? "+" : "-"} ${Math.abs(roll.damageAbilityScore)}`;
    let message = `${dieEmoji2} x (${roll.damageMultiplier} - ${roll.damageReduction}) ${damageBonusString}`;
    if (roll.isFantastic) {
      message = `(${message}) x 2`;
    }
    message = `${message} = **${roll.damage}**`;
    fields.push({
      name: "Damage",
      value: message,
    });

    if (roll.isNegated) {
      fields.push({
        name: "Note",
        value: `Damage Reduction (${roll.damageReduction}) completely absorbed the Damage Multiplier (${roll.damageMultiplier}).`,
      });
    }
  }

  const abilityScoreString = `${roll.abilityScore >= 0 ? `+${roll.abilityScore}` : `-${Math.abs(roll.abilityScore)}`}`;
  const initEdge = isInit && hasEdge ? "E" : "";

  const jsonData = {
    content: contentString,
    embeds: [
      {
        color: color,
        description: `**${dieEmoji1} ${dieEmoji2} ${dieEmoji3}** ${abilityScoreString}${initEdge}`,
        footer: {
          text: roll.isUltimateFantastic ? "ULTIMATE FANTASTIC" : roll.isFantastic ? "Fantastic" : "Standard",
        },
        thumbnail: {
          url: thumbnailUrl,
        },
        fields: fields,
      },
    ],
  };
  return JSON.stringify(jsonData);
}

function calculateRoll({ dieResult1, dieResult2, dieResult3, abilityScore }) {
  const isFantastic = dieResult2 === 1;
  const isUltimateFantastic = isFantastic && dieResult1 === 6 && dieResult3 === 6;
  const marvelDieResult = isFantastic ? 6 : dieResult2;
  const marvelDieText = isFantastic ? "M" : dieResult2;
  const result = dieResult1 + marvelDieResult + dieResult3 + abilityScore;
  return {
    abilityScore,
    dieResult1,
    dieResult2,
    dieResult3,
    marvelDieResult,
    marvelDieText,
    isFantastic,
    isUltimateFantastic,
    result,
  };
}

function calculateCombatRoll({
  dieResult1,
  dieResult2,
  dieResult3,
  abilityScore,
  damageAbilityScore,
  damageMultiplier,
  damageReduction,
}) {
  const roll = calculateRoll({ dieResult1, dieResult2, dieResult3, abilityScore });
  const evaluatedDamageMultiplier = damageMultiplier - damageReduction;
  const isNegated = evaluatedDamageMultiplier <= 0;
  roll.isNegated = isNegated;
  const fantasticMultiplier = roll.isFantastic ? 2 : 1;
  const damage = isNegated
    ? 0
    : fantasticMultiplier * (roll.marvelDieResult * evaluatedDamageMultiplier + damageAbilityScore);
  roll.damage = damage;
  roll.damageAbilityScore = damageAbilityScore;
  roll.damageMultiplier = damageMultiplier;
  roll.damageReduction = damageReduction;
  roll.hasDamage = true;
  return roll;
}

function createGridRow(classes, textContents, onClick) {
  const gridRow = document.createElement("div");
  gridRow.className = "content";

  if (onClick) {
    gridRow.classList.add("clickable");
    gridRow.addEventListener("click", onClick);
  }

  classes.forEach((className, index) => {
    const cell = document.createElement("div");
    cell.className = className;
    cell.textContent = textContents[index];
    gridRow.appendChild(cell);
  });

  return gridRow;
}

function getDieEmoji(value) {
  switch (value) {
    case 1:
      return "1️⃣";
    case 2:
      return "2️⃣";
    case 3:
      return "3️⃣";
    case 4:
      return "4️⃣";
    case 5:
      return "5️⃣";
    case 6:
      return "6️⃣";
    case 7:
      return "🟥";
    default:
      return null;
  }
}

async function getProfile(urlParams) {
  let profileId =
    urlParams.get("c") || localStorage.getItem("profileId") || prompt("Please enter your profile id:", "");

  let profile = null;
  if (profileId) {
    try {
      profile = await fetch(`./js/profile-${profileId}.json`).then((res) => res.json());
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  }

  if (!profile) {
    console.warn(`No character with ID: ${profileId} found.`);
    localStorage.removeItem("profileId");
    return null;
  }

  localStorage.setItem("profileId", profileId);
  return profile;
}

function getWebhookUrl(urlParams) {
  let webhookUrl = urlParams.get("w");

  if (webhookUrl) {
    localStorage.setItem("webhookUrl", webhookUrl);
  } else {
    webhookUrl = localStorage.getItem("webhookUrl");
  }

  if (!webhookUrl || !isValidHttpUrl(webhookUrl)) {
    webhookUrl = prompt("Please enter your webhook url:", "URL");
  }

  if (!webhookUrl || !isValidHttpUrl(webhookUrl)) {
    webhookUrl = null;
    localStorage.removeItem("webhookUrl");
    alert("Invalid URL. Proceeding without webhooks.");
  } else {
    localStorage.setItem("webhookUrl", webhookUrl);
  }

  return webhookUrl;
}

function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (err) {
    return false;
  }
}

function renderAbility(view, ability, abilityType, characterName, color, thumbnailUrl, webhookUrl) {
  select(".ability", view).textContent = ability.ability;
  select(".defense", view).textContent = ability.defense;
  select(".noncombat", view).textContent = `${ability.noncombat >= 0 ? "+" : "-"}${Math.abs(ability.noncombat)}`;

  view.addEventListener("click", () => {
    showPopUp({
      content: `Roll ${abilityType} Non-Combat?`,
      isPrimaryVisible: true,
      isSecondaryVisible: true,
      primaryText: "OK",
      secondaryText: "Cancel",
      onPrimaryClick: () => {
        const roll = calculateRoll({
          dieResult1: rollD6(),
          dieResult2: rollD6(),
          dieResult3: rollD6(),
          abilityScore: ability.noncombat,
        });
        roll.context = { abilityType, characterName, color, thumbnailUrl, webhookUrl };

        renderDice(roll, true);
        const message = buildRollMessage({ roll, ...roll.context });
        sendWebhookMessage(webhookUrl, message);
      },
    });
  });
}

function renderAbilities(profile, webhookUrl) {
  const abilities = ["melee", "agility", "resilience", "vigilance", "ego", "logic"];

  abilities.forEach((stat) => {
    const statName = stat.charAt(0).toUpperCase() + stat.slice(1);

    renderAbility(
      select(`#ability-row-${stat}`),
      profile.abilities[stat],
      statName,
      profile.name,
      profile.color,
      profile.photoUrl,
      webhookUrl,
    );
  });
}

function renderDamage(view, damage, abilityScore, abilityType, characterName, color, thumbnailUrl, webhookUrl) {
  select(".multiplier", view).textContent = `Marvel x ${damage.multiplier}`;
  select(".ability", view).textContent = damage.ability;

  view.addEventListener("click", () => {
    const damageAbilityScore = damage.ability;
    const damageMultiplier = damage.multiplier;
    showPopUp({
      content: `Roll ${abilityType} Attack?`,
      isNumberInputVisible: true,
      isPrimaryVisible: true,
      isSecondaryVisible: true,
      primaryText: "OK",
      secondaryText: "Cancel",
      numberLabelText: "Enter Damage Reduction:",
      onPrimaryClick: (damageReduction) => {
        const roll = calculateCombatRoll({
          dieResult1: rollD6(),
          dieResult2: rollD6(),
          dieResult3: rollD6(),
          abilityScore,
          damageAbilityScore,
          damageMultiplier,
          damageReduction,
        });
        roll.context = { abilityType, characterName, color, thumbnailUrl, webhookUrl };

        renderDice(roll, true);
        const message = buildRollMessage({ roll, ...roll.context });
        sendWebhookMessage(webhookUrl, message);
      },
    });
  });
}

function renderDamages(profile, webhookUrl) {
  const damageGrid = select("#damage-grid");
  const stats = ["melee", "agility", "ego", "logic"];

  stats.forEach((stat) => {
    const statName = stat.charAt(0).toUpperCase() + stat.slice(1);
    renderDamage(
      select(`#damage-row-${stat}`, damageGrid),
      profile.damage[stat],
      profile.abilities[stat].ability,
      statName,
      profile.name,
      profile.color,
      profile.photoUrl,
      webhookUrl,
    );
  });
}

function renderDice(roll, animate) {
  const diceContainer = select("#dice-container");

  const die1 = select("#die1", diceContainer);
  if (animate) {
    rotate360(die1, () => {
      die1.textContent = roll.dieResult1;
    });
  } else {
    die1.textContent = roll.dieResult1;
  }
  die1.onclick = () => renderReroll(roll, 1);

  const die2 = select("#die2", diceContainer);
  if (animate) {
    rotate360(die2, () => {
      die2.textContent = roll.marvelDieText;
    });
  } else {
    die2.textContent = roll.dieResult2;
  }
  die2.onclick = () => renderReroll(roll, 2);

  const die3 = select("#die3", diceContainer);
  if (animate) {
    rotate360(die3, () => {
      die3.textContent = roll.dieResult3;
    });
  } else {
    die3.textContent = roll.dieResult3;
  }
  die3.onclick = () => renderReroll(roll, 3);

  function renderCallback() {
    const isInit = roll.context.isInit;
    const hasEdge = roll.context.hasEdge;
    const initEdgeText = isInit && hasEdge ? "E" : "";

    select("#dice-ability-bonus", diceContainer).textContent =
      `${roll.abilityScore >= 0 ? "+" : ""}${roll.abilityScore}${initEdgeText}`;
    select("#dice-result-value", diceContainer).textContent = roll.result;

    if (roll.hasDamage) {
      let formula = `<div id="dice-damage-die">${roll.marvelDieText}</div> x (${roll.damageMultiplier} - ${roll.damageReduction}) ${roll.damageAbilityScore >= 0 ? "+" : "-"} ${Math.abs(roll.damageAbilityScore)}`;
      if (roll.isFantastic) {
        formula = `(${formula}) x 2`;
      }
      select("#dice-damage-calc", diceContainer).innerHTML = formula;
      select("#dice-damage-value", diceContainer).textContent = roll.damage;
      select("#dice-damage-row", diceContainer).classList.remove("hidden");
    } else {
      select("#dice-damage-row", diceContainer).classList.add("hidden");
    }

    if (roll.isUltimateFantastic) {
      select("#dice-type", diceContainer).textContent = `ULTIMATE FANTASTIC!`;
    } else if (roll.isFantastic) {
      select("#dice-type", diceContainer).textContent = `Fantastic!`;
    } else {
      select("#dice-type", diceContainer).textContent = `Standard`;
    }
  }

  if (animate) {
    setTimeout(() => {
      renderCallback();
    }, 750);
  } else {
    renderCallback();
  }
  diceContainer.classList.remove("hidden");
}

function renderPowers(characterPowers, powersData) {
  const fragment = document.createDocumentFragment();

  characterPowers.forEach((i) => {
    const power = powersData[i];
    const cost = power.cost === 0 ? "--" : power.cost;

    const row = createGridRow(["label power-name", "power-focus", "power-desc"], [power.name, cost, power.text], () => {
      showDetails({
        title: power.name,
        subtitle: power.power_set || "Power",
        meta: {
          Action: power.action,
          Trigger: power.trigger,
          Cost: power.cost === 0 ? "None" : power.cost,
          Range: power.range,
          Duration: power.duration,
          Effect: power.effect,
          Prerequisites: power.prerequisites,
        },
        bodyText: power.text,
      });
    });
    fragment.appendChild(row);
  });

  select("#powers-grid").appendChild(fragment);
}

function renderReroll(roll, dieIndex) {
  const rerollContainer = select("#reroll-container");
  rerollContainer.classList.remove("hidden");
  const dieElement = select("#reroll-alert-die", rerollContainer);
  const dieResultElement = select("#reroll-alert-die-result", rerollContainer);
  dieResultElement.textContent = "";

  const btnContainer = select("#reroll-top-button-container", rerollContainer);
  btnContainer.classList.remove("hidden");
  const btnCancel = select("#btn-reroll-cancel", rerollContainer);
  btnCancel.classList.remove("hidden");
  btnCancel.textContent = "Cancel";
  btnCancel.onclick = () => {
    rerollContainer.classList.add("hidden");
  };

  const btnEdge = select("#btn-reroll-edge", btnContainer);
  const btnTrouble = select("#btn-reroll-trouble", btnContainer);

  const rerollRejected = select("#reroll-rejected", rerollContainer);
  rerollRejected.classList.add("hidden");

  if (dieIndex === 2) {
    dieElement.classList.add("marvel-die");
    dieElement.textContent = roll.marvelDieText;
    dieResultElement.classList.add("marvel-die");
  } else {
    dieElement.classList.remove("marvel-die");
    dieElement.textContent = dieIndex === 1 ? roll.dieResult1 : roll.dieResult3;
    dieResultElement.classList.remove("marvel-die");
  }
  function reroll(isForEdge) {
    const newResult = rollD6();
    let oldResult1 = dieIndex === 1 ? newResult : roll.dieResult1;
    let oldResult2 = dieIndex === 2 ? newResult : roll.dieResult2;
    let oldResult3 = dieIndex === 3 ? newResult : roll.dieResult3;
    let newRoll;
    if (roll.hasDamage) {
      newRoll = calculateCombatRoll({
        dieResult1: oldResult1,
        dieResult2: oldResult2,
        dieResult3: oldResult3,
        abilityScore: roll.abilityScore,
        damageAbilityScore: roll.damageAbilityScore,
        damageMultiplier: roll.damageMultiplier,
        damageReduction: roll.damageReduction,
      });
    } else {
      newRoll = calculateRoll({
        dieResult1: oldResult1,
        dieResult2: oldResult2,
        dieResult3: oldResult3,
        abilityScore: roll.abilityScore,
      });
    }

    newRoll.context = roll.context;

    dieResultElement.textContent = dieIndex === 2 ? newRoll.marvelDieText : newResult;

    const isBetter = newRoll.result > roll.result || (!roll.isFantastic && newRoll.isFantastic);
    const isForEdgeAndBetter = isForEdge && isBetter;
    const isWorse = newRoll.result < roll.result || (roll.isFantastic && !newRoll.isFantastic);
    const isForTroubleAndWorse = !isForEdge && isWorse;
    if (!isForEdgeAndBetter && !isForTroubleAndWorse) {
      rerollRejected.classList.remove("hidden");
    } else if (newRoll.context && newRoll.context.webhookUrl) {
      const message = buildRollMessage({ roll: newRoll, isReroll: true, ...newRoll.context });
      sendWebhookMessage(newRoll.context.webhookUrl, message);
    }

    btnCancel.classList.remove("hidden");
    btnCancel.textContent = "Close";
    btnCancel.onclick = () => {
      if (isForEdgeAndBetter || isForTroubleAndWorse) {
        renderDice(newRoll, false);
      }
      rerollContainer.classList.add("hidden");
    };
  }

  let didRoll = false;
  btnEdge.onclick = () => {
    if (!didRoll) {
      didRoll = true;
      btnContainer.classList.add("hidden");
      btnCancel.classList.add("hidden");
      rotate360(dieElement, () => reroll(true));
    }
  };
  btnTrouble.onclick = () => {
    if (!didRoll) {
      didRoll = true;
      btnContainer.classList.add("hidden");
      btnCancel.classList.add("hidden");
      rotate360(dieElement, () => reroll(false));
    }
  };
}

function renderSimpleGrid(itemIds, sourceData, gridSelector, classes, itemType) {
  const fragment = document.createDocumentFragment();

  itemIds.forEach((id) => {
    const item = sourceData[id];
    const row = createGridRow(classes, [item.name, item.value], () => {
      showDetails({
        title: item.name,
        subtitle: itemType,
        meta: {},
        bodyText: item.value,
      });
    });
    fragment.appendChild(row);
  });

  select(gridSelector).appendChild(fragment);
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollInitiative(profile, webhookUrl) {
  const initiativeModifier = profile.initiative;
  showPopUp({
    content: `Roll for Initiative?`,
    isPrimaryVisible: true,
    isSecondaryVisible: true,
    primaryText: "OK",
    secondaryText: "Cancel",
    onPrimaryClick: () => {
      const roll = calculateRoll({
        dieResult1: rollD6(),
        dieResult2: rollD6(),
        dieResult3: rollD6(),
        abilityScore: initiativeModifier.value,
      });
      const abilityType = "Initiative";
      const characterName = profile.name;
      const color = profile.color;
      const thumbnailUrl = profile.photoUrl;
      const isInit = true;
      const hasEdge = initiativeModifier.edge;
      roll.context = { abilityType, characterName, color, thumbnailUrl, webhookUrl, isInit, hasEdge };

      renderDice(roll, true);
      const message = buildRollMessage({ roll, ...roll.context });
      sendWebhookMessage(webhookUrl, message);
    },
  });
}

function rotate360(die, callback) {
  die.classList.add("spin-active");
  setTimeout(() => {
    die.classList.remove("spin-active");
    callback();
  }, 750);
}

function sendWebhookMessage(webhookUrl, jsonMessage) {
  if (!webhookUrl) return;

  fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: jsonMessage,
  })
    .then((data) => console.log("Webhook Success:", data))
    .catch((error) => console.error("Webhook Error:", error));
}

function showDetails({ title, subtitle, meta = {}, bodyText }) {
  const detailsContainer = select("#details-container");

  select("#details-title", detailsContainer).textContent = title;
  select("#details-subtitle", detailsContainer).textContent = subtitle;
  select("#details-body", detailsContainer).textContent = bodyText || "";

  const metaContainer = select("#details-meta", detailsContainer);
  metaContainer.innerHTML = "";

  for (const [key, value] of Object.entries(meta)) {
    if (value && value !== "--" && value !== "None" && value !== "") {
      const badge = document.createElement("div");
      badge.classList.add("details-meta-badge");
      badge.innerHTML = `<strong>${key}:</strong> ${value}`;
      metaContainer.appendChild(badge);
    }
  }

  detailsContainer.classList.remove("hidden");
}

function showPopUp({
  content,
  primaryText,
  isPrimaryVisible,
  onPrimaryClick,
  secondaryText,
  isSecondaryVisible,
  onSecondaryClick,
  isNumberInputVisible,
  numberLabelText,
}) {
  const alertContainer = select("#alert-container");

  const contentContainer = select("#alert-content", alertContainer);
  if (content) {
    contentContainer.textContent = content;
    contentContainer.classList.remove("hidden");
  } else {
    contentContainer.classList.add("hidden");
  }

  const inputNumber = select("#inp-number");
  inputNumber.value = "";
  const labelNumber = select("#lbl-number");
  if (isNumberInputVisible) {
    inputNumber.classList.remove("hidden");
    labelNumber.classList.remove("hidden");
    labelNumber.textContent = numberLabelText;
  } else {
    inputNumber.classList.add("hidden");
    labelNumber.classList.add("hidden");
  }

  const btnPrimary = select("#btn-primary", alertContainer);
  if (isPrimaryVisible) {
    btnPrimary.textContent = primaryText;
    btnPrimary.classList.remove("hidden");
    btnPrimary.onclick = () => {
      alertContainer.classList.add("hidden");
      const inputNumberValue = isNumberInputVisible ? parseInt(inputNumber.value, 10) || 0 : null;
      if (onPrimaryClick) onPrimaryClick(inputNumberValue);
    };
  } else {
    btnPrimary.textContent = "";
    btnPrimary.classList.add("hidden");
  }

  const btnSecondary = select("#btn-secondary", alertContainer);
  if (isSecondaryVisible) {
    btnSecondary.textContent = secondaryText;
    btnSecondary.classList.remove("hidden");
    btnSecondary.onclick = () => {
      alertContainer.classList.add("hidden");
      if (onSecondaryClick) onSecondaryClick();
    };
  } else {
    btnSecondary.textContent = "";
    btnSecondary.classList.add("hidden");
  }

  alertContainer.classList.remove("hidden");
}

init();
