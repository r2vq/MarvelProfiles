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
  select(".value", select("#stat-karma")).textContent = `${profile.karma} / ${profile.karma}`;
  select(".value", select("#stat-health")).textContent = `${profile.health} / ${profile.health}`;
  select(".value", select("#stat-focus")).textContent = `${profile.focus} / ${profile.focus}`;
  select(".value", select("#stat-init")).textContent = buildInitiative(profile.initiative);

  document.body.className = profile.theme;

  renderTraits(profile.traits, traitsData);
  renderTags(profile.tags, tagsData);
  renderAbilities(profile, webhookUrl);
  renderDamages(profile, webhookUrl);
  renderPowers(profile.powers, powersData);

  select("#btn-delete-webhook").addEventListener("click", () => {
    if (confirm("Delete the webhook URL? This cannot be undone!!")) {
      localStorage.removeItem("webhookUrl");
    }
  });

  select("#dice-btn-close-dice").addEventListener("click", () => {
    select("#dice-container").classList.add("hidden");
  });
}

function buildInitiative(initiative) {
  return `${initiative.value > 0 ? "+" : ""}${initiative.value}${initiative.edge ? "E" : ""}`;
}

function buildRollMessage({ roll, abilityType, characterName, color, thumbnailUrl }) {
  const dieEmoji1 = getDieEmoji(roll.dieResult1);
  const dieEmoji2 = getDieEmoji(roll.isFantastic ? 7 : roll.marvelDieResult);
  const dieEmoji3 = getDieEmoji(roll.dieResult3);

  const damageString = roll.hasDamage ? ` Damage ${roll.damage}.` : "";
  const contentString = `${characterName} rolled ${abilityType}${roll.hasDamage ? " Attack" : ""}.\nResult ${roll.result}.${damageString}`;

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

  const jsonData = {
    content: contentString,
    embeds: [
      {
        color: color,
        description: `**${dieEmoji1} ${dieEmoji2} ${dieEmoji3}** ${abilityScoreString}`,
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
  const evaluatedDamageMultipler = damageMultiplier - damageReduction;
  const isNegated = evaluatedDamageMultipler <= 0;
  roll.isNegated = isNegated;
  const fantasticMultiplier = roll.isFantastic ? 2 : 1;
  const damage = isNegated
    ? 0
    : fantasticMultiplier * (roll.marvelDieResult * evaluatedDamageMultipler + damageAbilityScore);
  roll.damage = damage;
  roll.damageAbilityScore = damageAbilityScore;
  roll.damageMultiplier = damageMultiplier;
  roll.damageReduction = damageReduction;
  roll.hasDamage = true;
  return roll;
}

function createGridRow(classes, textContents) {
  const gridRow = document.createElement("div");
  gridRow.className = "content";

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

        renderDice(roll);

        const message = buildRollMessage({
          roll,
          abilityType,
          characterName,
          color,
          thumbnailUrl,
        });

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

        renderDice(roll);

        const message = buildRollMessage({
          roll,
          abilityType,
          characterName,
          color,
          thumbnailUrl,
        });

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

function renderDice(roll) {
  const diceContainer = select("#dice-container");

  const die1 = select("#die1", diceContainer);
  die1.textContent = roll.dieResult1;
  die1.onclick = () => {
    renderReroll(roll, 1);
  };
  const die2 = select("#die2", diceContainer);
  die2.textContent = roll.marvelDieText;
  die2.onclick = () => {
    renderReroll(roll, 2);
  };
  const die3 = select("#die3", diceContainer);
  die3.textContent = roll.dieResult3;
  die3.onclick = () => {
    renderReroll(roll, 3);
  };

  select("#dice-ability-bonus", diceContainer).textContent = `${roll.abilityScore >= 0 ? "+" : ""}${roll.abilityScore}`;
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
    select("#dice-type", diceContainer).textContent = "ULTIMATE FANTASTIC!";
  } else if (roll.isFantastic) {
    select("#dice-type", diceContainer).textContent = "Fantastic!";
  } else {
    select("#dice-type", diceContainer).textContent = "Standard";
  }
  diceContainer.classList.remove("hidden");
}

function renderPowers(characterPowers, powersData) {
  const fragment = document.createDocumentFragment();

  characterPowers.forEach((i) => {
    const power = powersData[i];
    const cost = power.cost === 0 ? "--" : power.cost;

    const row = createGridRow(["label power-name", "power-focus", "power-desc"], [power.name, cost, power.text]);
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
  let oldResult;
  switch (dieIndex) {
    case 1:
      oldResult = roll.dieResult1;
      dieElement.classList.remove("marvel-die");
      dieElement.textContent = roll.dieResult1;

      dieResultElement.classList.remove("marvel-die");
      break;
    case 2:
      oldResult = roll.dieResult2;
      dieElement.classList.add("marvel-die");
      dieElement.textContent = roll.marvelDieText;

      dieResultElement.classList.add("marvel-die");
      break;
    case 3:
      oldResult = roll.dieResult3;
      dieElement.classList.remove("marvel-die");
      dieElement.textContent = roll.dieResult3;

      dieResultElement.classList.remove("marvel-die");
      break;
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

    let textContent;
    switch (dieIndex) {
      case 1:
        textContent = newRoll.dieResult1;
        break;
      case 2:
        textContent = newRoll.marvelDieText;
        break;
      case 3:
        textContent = newRoll.dieResult3;
        break;
    }

    dieResultElement.textContent = textContent;
    btnCancel.classList.remove("hidden");
    btnCancel.textContent = "Close";
    btnCancel.onclick = () => {
      if (isForEdge && (newRoll.result > roll.result) || (!roll.isFantastic && newRoll.isFantastic)) {
        renderDice(newRoll);
      }
      if (!isForEdge && (newRoll.result < roll.result) || (roll.isFantastic && !newRoll.isFantastic)) {
        renderDice(newRoll);
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
      rotate360(dieElement, () => {
        reroll(true);
      });
    }
  };
  btnTrouble.onclick = () => {
    if (!didRoll) {
      didRoll = true;
      btnContainer.classList.add("hidden");
      btnCancel.classList.add("hidden");
      rotate360(dieElement, () => {
        reroll(false);
      });
    }
  };
}

function renderTags(characterTags, tagsData) {
  const fragment = document.createDocumentFragment();

  characterTags.forEach((i) => {
    const tag = tagsData[i];
    const row = createGridRow(["tag-label", "tag-value"], [tag.name, tag.value]);
    fragment.appendChild(row);
  });

  select("#tags-grid").appendChild(fragment);
}

function renderTraits(characterTraits, traitsData) {
  const fragment = document.createDocumentFragment();

  characterTraits.forEach((i) => {
    const trait = traitsData[i];
    const row = createGridRow(["trait-label", "trait-value"], [trait.name, trait.value]);
    fragment.appendChild(row);
  });

  select("#traits-grid").appendChild(fragment);
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
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
