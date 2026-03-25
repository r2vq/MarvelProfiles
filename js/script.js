import powers from "../data/powers.json" with { type: "json" };
import tags from "../data/tags.json" with { type: "json" };
import traits from "../data/traits.json" with { type: "json" };
import d616 from "./core/d616.mjs";
import profileManager from "./managers/profile-manager.mjs";
import storageManager from "./managers/storage-manager.mjs";
import webhookManager from "./managers/webhook-manager.mjs";
import { select } from "./utils/view-utils.mjs";

const ROTATE_TIME = 750;

async function init() {
  const urlParams = new URLSearchParams(window.location.search);

  const profile = await profileManager.getProfile(urlParams);
  if (!profile) {
    return;
  }

  webhookManager.updateWebhookUrl(urlParams);

  buildCharacterSheet({ profile });
}

function buildCharacterSheet({ profile }) {
  select("#character-name").textContent = profile.name;
  select("#secret-identity").textContent = profile.secretIdentity;
  select("#character-photo").src = profile.photoUrl;

  select(".value", select("#stat-rank")).textContent = profile.rank;

  const setupStatCard = (cardSelector, statName, maxVal, currentVal, onStoreStat) => {
    const card = select(cardSelector);

    select(".value", card).textContent = `${currentVal === null ? maxVal : currentVal} / ${maxVal}`;
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
          onStoreStat({ newValue: newValue });
          select(".value", card).textContent = `${newValue} / ${maxVal}`;
        },
      });

      select("#inp-number").value = currentVal;
    });
  };

  setupStatCard("#stat-health", "Health", profile.health, storageManager.getSavedHealth(), ({ newValue }) => {
    const oldValue = storageManager.getSavedHealth();
    const maxValue = profile.health;
    storageManager.updateHealth({ newValue });
    webhookManager.sendMessageStats({
      maxValue,
      newValue,
      oldValue,
      profile,
      statName: "Health",
      stats: {
        health: {
          current: storageManager.getSavedHealth(),
          max: profile.health,
        },
        focus: {
          current: storageManager.getSavedFocus(),
          max: profile.focus,
        },
        karma: {
          current: storageManager.getSavedKarma(),
          max: profile.karma,
        },
      },
    });
  });
  setupStatCard("#stat-focus", "Focus", profile.focus, storageManager.getSavedFocus(), ({ newValue }) => {
    const oldValue = storageManager.getSavedFocus();
    const maxValue = profile.focus;
    storageManager.updateFocus({ newValue });
    webhookManager.sendMessageStats({
      maxValue,
      newValue,
      oldValue,
      profile,
      statName: "Focus",
      stats: {
        health: {
          current: storageManager.getSavedHealth(),
          max: profile.health,
        },
        focus: {
          current: storageManager.getSavedFocus(),
          max: profile.focus,
        },
        karma: {
          current: storageManager.getSavedKarma(),
          max: profile.karma,
        },
      },
    });
  });
  setupStatCard("#stat-karma", "Karma", profile.karma, storageManager.getSavedKarma(), ({ newValue }) => {
    const oldValue = storageManager.getSavedKarma();
    const maxValue = profile.karma;
    storageManager.updateKarma({ newValue });
    webhookManager.sendMessageStats({
      maxValue,
      newValue,
      oldValue,
      profile,
      statName: "Karma",
      stats: {
        health: {
          current: storageManager.getSavedHealth(),
          max: profile.health,
        },
        focus: {
          current: storageManager.getSavedFocus(),
          max: profile.focus,
        },
        karma: {
          current: storageManager.getSavedKarma(),
          max: profile.karma,
        },
      },
    });
  });

  select(".value", select("#stat-init")).textContent =
    `${profile.initiative.value > 0 ? "+" : ""}${profile.initiative.value}${profile.initiative.edge ? "E" : ""}`;

  document.body.className = profile.theme;
  renderSimpleGrid({
    itemIds: profile.traits,
    sourceData: traits,
    gridSelector: "#traits-grid",
    classes: ["trait-label"],
    itemType: "Trait",
  });
  renderSimpleGrid({
    itemIds: profile.tags,
    sourceData: tags,
    gridSelector: "#tags-grid",
    classes: ["tag-label"],
    itemType: "Tag",
  });

  renderAbilities({ profile });
  renderDamages({ profile });
  renderPowers({ characterPowers: profile.powers, powersData: powers });

  select("#btn-delete-webhook").addEventListener("click", () => {
    if (confirm("Delete the webhook URL? This cannot be undone!!")) {
      storageManager.clearWebhookUrl();
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
    rollInitiative({ profile });
  });
}

function createGridRow({ classes, textContents, onClick }) {
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

function renderAbility({ profile, view, ability, abilityType }) {
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
        const abilityScore = ability.ability;
        const roll = d616.rollAbility({ abilityScore });
        renderDice({
          abilityScore,
          abilityType,
          animate: true,
          profile,
          roll,
        });
        webhookManager.sendMessageAbility({
          abilityType,
          abilityScore,
          isReroll: false,
          profile,
          roll,
        });
      },
    });
  });
}

function renderAbilities({ profile }) {
  const abilities = ["melee", "agility", "resilience", "vigilance", "ego", "logic"];

  abilities.forEach((stat) => {
    const statName = stat.charAt(0).toUpperCase() + stat.slice(1);

    renderAbility({
      profile,
      view: select(`#ability-row-${stat}`),
      ability: profile.abilities[stat],
      abilityType: statName,
    });
  });
}

function renderDamage({ view, damage, abilityScore, abilityType, profile }) {
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
      onPrimaryClick: (rawDamageReduction) => {
        const damageReduction = Math.abs(rawDamageReduction);
        const roll = d616.rollDamage({ abilityScore, damageAbilityScore, damageMultiplier, damageReduction });
        renderDice({
          abilityScore,
          abilityType,
          animate: true,
          damageContext: {
            damageAbilityScore,
            damageMultiplier,
            damageReduction,
          },
          profile,
          roll,
        });
        webhookManager.sendMessageDamage({
          abilityType,
          abilityScore,
          damageAbilityScore,
          damageMultiplier,
          damageReduction,
          isReroll: false,
          profile,
          roll,
        });
      },
    });
  });
}

function renderDamages({ profile }) {
  const damageGrid = select("#damage-grid");
  const stats = ["melee", "agility", "ego", "logic"];

  stats.forEach((stat) => {
    const statName = stat.charAt(0).toUpperCase() + stat.slice(1);
    renderDamage({
      view: select(`#damage-row-${stat}`, damageGrid),
      damage: profile.damage[stat],
      abilityScore: profile.abilities[stat].ability,
      abilityType: statName,
      profile,
    });
  });
}

function renderDice({ abilityScore, abilityType, animate, damageContext, initContext, profile, roll }) {
  const diceContainer = select("#dice-container");
  const diceResult = select("#dice-result-value", diceContainer);
  diceResult.textContent = "";

  const die1 = select("#die1", diceContainer);
  if (animate) {
    rotate360({
      die: die1,
      callback: () => {
        die1.textContent = roll.die1.text;
      },
    });
  } else {
    die1.textContent = roll.die1.text;
  }
  die1.onclick = () =>
    renderReroll({ abilityScore, abilityType, damageContext, dieIndex: 1, initContext, profile, roll });

  const die2 = select("#die2", diceContainer);
  if (animate) {
    rotate360({
      die: die2,
      callback: () => {
        die2.textContent = roll.die2.text;
      },
    });
  } else {
    die2.textContent = roll.die2.text;
  }
  die2.onclick = () =>
    renderReroll({ abilityScore, abilityType, damageContext, dieIndex: 2, initContext, profile, roll });

  const die3 = select("#die3", diceContainer);
  if (animate) {
    rotate360({
      die: die3,
      callback: () => {
        die3.textContent = roll.die3.text;
      },
    });
  } else {
    die3.textContent = roll.die3.text;
  }
  die3.onclick = () =>
    renderReroll({ abilityScore, abilityType, damageContext, dieIndex: 3, initContext, profile, roll });

  function renderCallback() {
    const hasInitEdge = initContext != null && initContext.hasEdge;
    const initEdgeText = hasInitEdge ? "E" : "";

    select("#dice-ability-bonus", diceContainer).textContent =
      `${abilityScore >= 0 ? "+" : ""}${abilityScore}${initEdgeText}`;
    diceResult.textContent = roll.total;

    const hasDamage = damageContext;
    if (hasDamage) {
      let formula = `<div id="dice-damage-die">${roll.die2.text}</div> x (${damageContext.damageMultiplier} - ${damageContext.damageReduction}) ${damageContext.damageAbilityScore >= 0 ? "+" : "-"} ${Math.abs(damageContext.damageAbilityScore)}`;
      if (roll.isFantastic) {
        formula = `(${formula}) x 2`;
      }
      select("#dice-damage-calc", diceContainer).innerHTML = formula;
      select("#dice-damage-value", diceContainer).textContent = roll.totalDamage;
      select("#dice-damage-row", diceContainer).classList.remove("hidden");
    } else {
      select("#dice-damage-row", diceContainer).classList.add("hidden");
    }

    const isFantastic = roll.die2.isMarvel;
    const isUltimateFantastic = roll.die1.value === 6 && isFantastic && roll.die3.value === 6;
    if (isUltimateFantastic) {
      select("#dice-type", diceContainer).textContent = "ULTIMATE FANTASTIC!";
    } else if (isFantastic) {
      select("#dice-type", diceContainer).textContent = "Fantastic!";
    } else {
      select("#dice-type", diceContainer).textContent = "Standard";
    }
  }

  if (animate) {
    setTimeout(() => {
      renderCallback();
    }, ROTATE_TIME);
  } else {
    renderCallback();
  }
  diceContainer.classList.remove("hidden");
}

function renderPowers({ characterPowers, powersData }) {
  const fragment = document.createDocumentFragment();

  characterPowers.forEach((i) => {
    const power = powersData[i];
    const cost = power.cost === 0 ? "--" : power.cost;

    const row = createGridRow({
      classes: ["label power-name", "power-focus", "power-desc"],
      textContents: [power.name, cost, power.text],
      onClick: () => {
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
      },
    });
    fragment.appendChild(row);
  });

  select("#powers-grid").appendChild(fragment);
}

function renderReroll({ abilityType, abilityScore, damageContext, dieIndex, initContext, profile, roll }) {
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
    dieElement.textContent = roll.die2.text;
    dieResultElement.classList.add("marvel-die");
  } else {
    dieElement.classList.remove("marvel-die");
    dieElement.textContent = dieIndex === 1 ? roll.die1.text : roll.die3.text;
    dieResultElement.classList.remove("marvel-die");
  }
  function reroll(isForEdge) {
    const newRoll = (() => {
      if (initContext) {
        return d616.rerollInitiative({
          initiativeModifier: initContext,
          originalRoll: roll,
          rerollPoisition: dieIndex,
        });
      } else if (roll.totalDamage != null) {
        return d616.rerollDamage({
          abilityScore,
          damageAbilityScore: damageContext.damageAbilityScore,
          damageMultiplier: damageContext.damageMultiplier,
          damageReduction: damageContext.damageReduction,
          originalRoll: roll,
          rerollPoisition: dieIndex,
        });
      } else {
        return d616.rerollAbility({
          abilityScore,
          originalRoll: roll,
          rerollPoisition: dieIndex,
        });
      }
    })();

    const [oldDie, newDie] = (() => {
      switch (dieIndex) {
        case 1:
          return [roll.die1, newRoll.die1];
        case 2:
          return [roll.die2, newRoll.die2];
        case 3:
          return [roll.die3, newRoll.die3];
      }
    })();
    dieResultElement.textContent = newDie.text;

    const isBetter = newDie.value > oldDie.value || (newDie.isMarvel && !oldDie.isMarvel);
    const isForEdgeAndBetter = isForEdge && isBetter;
    const isWorse = newDie.value < oldDie.value || (!newDie.isMarvel && oldDie.isMarvel);
    const isForTroubleAndWorse = !isForEdge && isWorse;
    const isFailedReroll = !isForEdgeAndBetter && !isForTroubleAndWorse;

    if (isFailedReroll) {
      rerollRejected.classList.remove("hidden");
    }

    if (initContext) {
      webhookManager.sendMessageInitiative({
        isFailedReroll,
        isReroll: true,
        profile,
        roll: newRoll,
      });
    } else if (roll.totalDamage != null) {
      webhookManager.sendMessageDamage({
        abilityType,
        abilityScore,
        damageAbilityScore: damageContext.damageAbilityScore,
        damageMultiplier: damageContext.damageMultiplier,
        damageReduction: damageContext.damageReduction,
        isReroll: true,
        profile,
        roll: newRoll,
      });
    } else {
      webhookManager.sendMessageAbility({
        abilityType: abilityType,
        abilityScore,
        isFailedReroll,
        isReroll: true,
        profile,
        roll: newRoll,
      });
    }

    btnCancel.classList.remove("hidden");
    btnCancel.textContent = "Close";
    btnCancel.onclick = () => {
      if (isForEdgeAndBetter || isForTroubleAndWorse) {
        renderDice({
          abilityScore,
          abilityType,
          animate: false,
          damageContext: damageContext,
          initContext: initContext,
          profile,
          roll: newRoll,
        });
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
      rotate360({ die: dieElement, callback: () => reroll(true) });
    }
  };
  btnTrouble.onclick = () => {
    if (!didRoll) {
      didRoll = true;
      btnContainer.classList.add("hidden");
      btnCancel.classList.add("hidden");
      rotate360({ die: dieElement, callback: () => reroll(false) });
    }
  };
}

function renderSimpleGrid({ itemIds, sourceData, gridSelector, classes, itemType }) {
  const fragment = document.createDocumentFragment();

  itemIds.forEach((id) => {
    const item = sourceData[id];
    const row = createGridRow({
      classes,
      textContents: [item.name],
      onClick: () => {
        showDetails({
          title: item.name,
          subtitle: itemType,
          meta: {},
          bodyText: item.value,
        });
      },
    });
    fragment.appendChild(row);
  });

  select(gridSelector).appendChild(fragment);
}

function rollInitiative({ profile }) {
  const initiativeModifier = profile.initiative;
  const abilityScore = initiativeModifier.value;
  showPopUp({
    content: `Roll for Initiative?`,
    isPrimaryVisible: true,
    isSecondaryVisible: true,
    primaryText: "OK",
    secondaryText: "Cancel",
    onPrimaryClick: () => {
      const roll = d616.rollInitiative({ initiativeModifier });
      const animate = true;
      const initContext = initiativeModifier;

      renderDice({ abilityScore, animate, profile, roll, initContext });
      webhookManager.sendMessageInitiative({ profile, roll, isReroll: false });
    },
  });
}

function rotate360({ die, callback }) {
  die.classList.add("spin-active");
  setTimeout(() => {
    die.classList.remove("spin-active");
    callback();
  }, ROTATE_TIME);
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
