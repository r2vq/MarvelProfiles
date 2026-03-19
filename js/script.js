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
}

function buildInitiative(initiative) {
  return `${initiative.value > 0 ? "+" : ""}${initiative.value}${initiative.edge ? "E" : ""}`;
}

function buildRollMessage({
  abilityScore,
  abilityType,
  characterName,
  color,
  damageBonus,
  damageMultiplier,
  damageReduction,
  dieResult1,
  dieResult2,
  dieResult3,
  thumbnailUrl,
}) {
  const isAttack = damageMultiplier > 0;
  const isFantastic = dieResult2 === 1;
  const isUltimateFantastic = isFantastic && dieResult1 === 6 && dieResult3 === 6;
  const isAbsorbedByDamageReduction = isAttack && damageReduction >= damageMultiplier;
  const marvelizedDieResult = isFantastic ? 6 : dieResult2;
  const resultTotal = dieResult1 + marvelizedDieResult + dieResult3 + abilityScore;

  const damageTotal = calculateDamageTotal(
    isAttack,
    marvelizedDieResult,
    damageMultiplier,
    damageReduction,
    damageBonus,
    isFantastic,
  );

  const dieEmoji1 = getDieEmoji(dieResult1);
  const dieEmoji2 = getDieEmoji(dieResult2 === 1 ? 7 : dieResult2);
  const dieEmoji3 = getDieEmoji(dieResult3);

  const damageString = isAttack ? ` Damage ${damageTotal}.` : "";
  const contentString = `${characterName} rolled ${abilityType}${isAttack ? " Attack" : ""}.\nResult ${resultTotal}.${damageString}`;

  const fields = [
    {
      name: "Result",
      value: `**${resultTotal}**`,
    },
  ];

  if (isAttack) {
    const damageBonusString = damageBonus >= 0 ? `+ ${damageBonus}` : `- ${Math.abs(damageBonus)}`;
    const fantasticString = isFantastic ? "(x2) " : "";
    fields.push({
      name: "Damage",
      value: `${dieEmoji2} x (${damageMultiplier} - ${damageReduction}) ${damageBonusString} ${fantasticString}= **${damageTotal}**`,
    });

    if (isAbsorbedByDamageReduction) {
      fields.push({
        name: "Note",
        value: `Damage Reduction (${damageReduction}) completely absorbed the Damage Multiplier (${damageMultiplier}).`,
      });
    }
  }

  const abilityScoreString = `${abilityScore >= 0 ? `+${abilityScore}` : `-${Math.abs(abilityScore)}`}`;

  const jsonData = {
    content: contentString,
    embeds: [
      {
        color: color,
        description: `**${dieEmoji1} ${dieEmoji2} ${dieEmoji3}** ${abilityScoreString}`,
        footer: {
          text: isUltimateFantastic ? "ULTIMATE FANTASTIC" : isFantastic ? "Fantastic" : "Standard",
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

function calculateDamageTotal(
  isAttack,
  marvelizedDieResult,
  damageMultiplier,
  damageReduction,
  damageBonus,
  isFantastic,
) {
  if (!isAttack) return 0;

  const effectiveMultiplier = Math.max(0, damageMultiplier - damageReduction);

  if (effectiveMultiplier <= 0) return 0;

  let total = marvelizedDieResult * effectiveMultiplier + damageBonus;

  if (isFantastic) {
    total *= 2;
  }

  return Math.max(0, total);
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
  let profileId = urlParams.get("c");

  if (!profileId) {
    profileId = localStorage.getItem("profileId");
  }

  if (!profileId) {
    profileId = prompt("Please enter your profile id:", "");
  }

  let profile;
  try {
    if (profileId) {
      profile = await fetch(`./js/profile-${profileId}.json`).then((res) => res.json());
    }
  } catch (error) {
    profile = null;
    console.error("Failed to load profile:", error);
  }

  if (!profile) {
    console.warn(`No character with ID: ${profileId} found.`);
    localStorage.removeItem("profileId");
    return;
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
        const message = buildRollMessage({
          abilityScore: ability.ability,
          abilityType: abilityType,
          characterName: characterName,
          color: color,
          dieResult1: rollD6(),
          dieResult2: rollD6(),
          dieResult3: rollD6(),
          thumbnailUrl: thumbnailUrl,
        });

        sendWebhookMessage(webhookUrl, message);
      },
    });
  });
}

function renderAbilities(profile, webhookUrl) {
  renderAbility(
    select("#ability-row-melee"),
    profile.abilities.melee,
    "Melee",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
  renderAbility(
    select("#ability-row-agility"),
    profile.abilities.agility,
    "Agility",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
  renderAbility(
    select("#ability-row-resilience"),
    profile.abilities.resilience,
    "Resilience",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
  renderAbility(
    select("#ability-row-vigilance"),
    profile.abilities.vigilance,
    "Vigilance",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
  renderAbility(
    select("#ability-row-ego"),
    profile.abilities.ego,
    "Ego",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
  renderAbility(
    select("#ability-row-logic"),
    profile.abilities.logic,
    "Logic",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
}

function renderDamage(view, damage, abilityScore, abilityType, characterName, color, thumbnailUrl, webhookUrl) {
  select(".multiplier", view).textContent = `Marvel X ${damage.multiplier}`;
  select(".ability", view).textContent = damage.ability;

  view.addEventListener("click", () => {
    showPopUp({
      content: `Roll ${abilityType} Attack?`,
      isNumberInputVisible: true,
      isPrimaryVisible: true,
      isSecondaryVisible: true,
      primaryText: "OK",
      secondaryText: "Cancel",
      numberLabelText: "Enter Damage Reduction:",
      onPrimaryClick: (damageReduction) => {
        const message = buildRollMessage({
          abilityScore: abilityScore,
          abilityType: abilityType,
          characterName: characterName,
          color: color,
          damageBonus: damage.ability,
          damageMultiplier: damage.multiplier,
          damageReduction: damageReduction > 0 ? damageReduction : 0,
          dieResult1: rollD6(),
          dieResult2: rollD6(),
          dieResult3: rollD6(),
          thumbnailUrl: thumbnailUrl,
        });

        sendWebhookMessage(webhookUrl, message);
      },
    });
  });
}

function renderDamages(profile, webhookUrl) {
  const damageGrid = select("#damage-grid");

  renderDamage(
    select("#damage-row-melee", damageGrid),
    profile.damage.melee,
    profile.abilities.melee.ability,
    "Melee",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
  renderDamage(
    select("#damage-row-agility", damageGrid),
    profile.damage.agility,
    profile.abilities.agility.ability,
    "Agility",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
  renderDamage(
    select("#damage-row-ego", damageGrid),
    profile.damage.ego,
    profile.abilities.ego.ability,
    "Ego",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
  renderDamage(
    select("#damage-row-logic", damageGrid),
    profile.damage.logic,
    profile.abilities.logic.ability,
    "Logic",
    profile.name,
    profile.color,
    profile.photoUrl,
    webhookUrl,
  );
}

function renderPowers(characterPowers, powersData) {
  const powersGrid = select("#powers-grid");
  const fragment = document.createDocumentFragment();

  characterPowers.forEach((i) => {
    const power = powersData[i];

    const rowTitle = document.createElement("div");
    rowTitle.className = "label power-name";
    rowTitle.textContent = power.name;

    const rowDescription = document.createElement("div");
    rowDescription.className = "power-desc";
    rowDescription.textContent = power.text;

    const rowFocus = document.createElement("div");
    rowFocus.className = "power-focus";
    rowFocus.textContent = power.cost === 0 ? "--" : power.cost;

    const gridRow = document.createElement("div");
    gridRow.className = "content";
    gridRow.appendChild(rowTitle);
    gridRow.appendChild(rowFocus);
    gridRow.appendChild(rowDescription);

    fragment.appendChild(gridRow);
  });

  powersGrid.appendChild(fragment);
}

function renderTags(characterTags, tagsData) {
  const tagsGrid = select("#tags-grid");
  const fragment = document.createDocumentFragment();

  characterTags.forEach((i) => {
    const tag = tagsData[i];

    const rowTitle = document.createElement("div");
    rowTitle.className = "tag-label";
    rowTitle.textContent = tag.name;

    const rowDescription = document.createElement("div");
    rowDescription.className = "tag-value";
    rowDescription.textContent = tag.value;

    const gridRow = document.createElement("div");
    gridRow.className = "content";
    gridRow.appendChild(rowTitle);
    gridRow.appendChild(rowDescription);

    fragment.appendChild(gridRow);
  });

  tagsGrid.appendChild(fragment);
}

function renderTraits(characterTraits, traitsData) {
  const traitsGrid = select("#traits-grid");
  const fragment = document.createDocumentFragment();

  characterTraits.forEach((i) => {
    const trait = traitsData[i];

    const rowTitle = document.createElement("div");
    rowTitle.className = "trait-label";
    rowTitle.textContent = trait.name;

    const rowDescription = document.createElement("div");
    rowDescription.className = "trait-value";
    rowDescription.textContent = trait.value;

    const gridRow = document.createElement("div");
    gridRow.className = "content";
    gridRow.appendChild(rowTitle);
    gridRow.appendChild(rowDescription);

    fragment.appendChild(gridRow);
  });

  traitsGrid.appendChild(fragment);
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function sendWebhookMessage(webhookUrl, jsonMessage) {
  if (!webhookUrl) return;

  console.log(jsonMessage);

  fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: jsonMessage,
  })
    .then((data) => console.log("Success:", data))
    .catch((error) => {
      console.error("Error:", error);
    });
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
