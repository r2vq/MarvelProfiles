import storageManager from "./storage-manager.mjs";

let _webhookUrl;

function updateWebhookUrl(urlParams) {
  if (urlParams === null) {
    console.warn("No urlParams passed in to Webhook Manager");
    return null;
  }

  let webhookUrl = urlParams.get("w");

  if (!webhookUrl) {
    webhookUrl = storageManager.getSavedWebhookUrl();
  }

  if (!webhookUrl || !isValidHttpUrl(webhookUrl)) {
    webhookUrl = prompt("Please enter your webhook url:", "URL");
  }

  if (!webhookUrl || !isValidHttpUrl(webhookUrl)) {
    webhookUrl = null;
    storageManager.clearWebhookUrl();
    alert("Invalid URL. Proceeding without webhooks.");
  } else {
    storageManager.updateWebhookUrl({ newValue: webhookUrl });
  }

  _webhookUrl = webhookUrl;
}

function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (err) {
    return false;
  }
}

function sendMessageAbility({ abilityType, abilityScore, isFailedReroll, isReroll, profile, roll }) {
  const isFantastic = roll.die2.isMarvel;
  const isUltimateFantastic = roll.die1.value === 6 && isFantastic && roll.die3.value === 6;

  const dieEmoji1 = getDieEmoji(roll.die1.value);
  const dieEmoji2 = getDieEmoji(isFantastic ? 0 : roll.die2.value);
  const dieEmoji3 = getDieEmoji(roll.die3.value);

  const rerollPrefix = isFailedReroll ? "**[REROLL FAILED]** " : isReroll ? "**[REROLL]** " : "";
  const abilityScoreString = `${abilityScore >= 0 ? "+" : ""}${abilityScore}`;

  const jsonData = {
    content: `${rerollPrefix}${profile.name} rolled ${abilityType}.\nResult ${roll.total}.`,
    embeds: [
      {
        color: profile.color,
        description: `**${dieEmoji1} ${dieEmoji2} ${dieEmoji3}** ${abilityScoreString}`,
        footer: {
          text: isUltimateFantastic ? "ULTIMATE FANTASTIC" : isFantastic ? "Fantastic" : "Standard",
        },
        thumbnail: {
          url: profile.photoUrl,
        },
        fields: [
          {
            name: "Result",
            value: `**${roll.total}**`,
          },
        ],
      },
    ],
  };
  sendWebhookMessage(JSON.stringify(jsonData));
}

function sendMessageDamage({
  abilityType,
  abilityScore,
  damageAbilityScore,
  damageMultiplier,
  damageReduction,
  isReroll,
  profile,
  roll,
}) {
  const isFantastic = roll.die2.isMarvel;
  const isUltimateFantastic = roll.die1.value === 6 && isFantastic && roll.die3.value === 6;

  const dieEmoji1 = getDieEmoji(roll.die1.value);
  const dieEmoji2 = getDieEmoji(isFantastic ? 0 : roll.die2.value);
  const dieEmoji3 = getDieEmoji(roll.die3.value);

  const damageString = ` Damage ${roll.totalDamage}.`;
  const rerollPrefix = isReroll ? "**[REROLL]** " : "";
  const contentString = `${rerollPrefix}${profile.name} rolled ${abilityType} Attack.\nResult ${roll.total}.${damageString}`;

  const reducedMultiplier = damageMultiplier - damageReduction;
  const doesDamage = reducedMultiplier > 0;

  const damageAbilityScoreString = `${damageAbilityScore >= 0 ? "+" : ""}${damageAbilityScore}`;
  let message = `${dieEmoji2} x (${damageMultiplier} - ${damageReduction}) ${damageAbilityScoreString}`;
  if (isFantastic) {
    message = `(${message}) x 2`;
  }
  message = `${message} = **${roll.totalDamage}**`;

  const fields = [
    {
      name: "Result",
      value: `**${roll.total}**`,
    },
    {
      name: "Damage",
      value: message,
    },
  ];

  if (!doesDamage) {
    fields.push({
      name: "Note",
      value: `Damage Reduction (${damageReduction}) completely absorbed the Damage Multiplier (${damageMultiplier}).`,
    });
  }

  const abilityScoreString = `${abilityScore >= 0 ? "+" : ""}${abilityScore}`;

  const jsonData = {
    content: contentString,
    embeds: [
      {
        color: profile.color,
        description: `**${dieEmoji1} ${dieEmoji2} ${dieEmoji3}** ${abilityScoreString}`,
        footer: {
          text: isUltimateFantastic ? "ULTIMATE FANTASTIC" : isFantastic ? "Fantastic" : "Standard",
        },
        thumbnail: {
          url: profile.photoUrl,
        },
        fields: fields,
      },
    ],
  };
  sendWebhookMessage(JSON.stringify(jsonData));
}

function sendMessageInitiative({ isFailedReroll, isReroll, profile, roll }) {
  const isFantastic = roll.die2.isMarvel;
  const isUltimateFantastic = roll.die1.value === 6 && isFantastic && roll.die3.value === 6;

  const dieEmoji1 = getDieEmoji(roll.die1.value);
  const dieEmoji2 = getDieEmoji(isFantastic ? 0 : roll.die2.value);
  const dieEmoji3 = getDieEmoji(roll.die3.value);

  const rerollPrefix = isFailedReroll ? "**[REROLL FAILED]** " : isReroll ? "**[REROLL]** " : "";
  const initiativeModifier = `${profile.initiative.value}${profile.initiative.edge ? "E" : ""}`;

  const jsonData = {
    content: `${rerollPrefix}${profile.name} rolled Initiative.\nResult ${roll.total}.`,
    embeds: [
      {
        color: profile.color,
        description: `**${dieEmoji1} ${dieEmoji2} ${dieEmoji3}** ${initiativeModifier}`,
        footer: {
          text: isUltimateFantastic ? "ULTIMATE FANTASTIC" : isFantastic ? "Fantastic" : "Standard",
        },
        thumbnail: {
          url: profile.photoUrl,
        },
        fields: [
          {
            name: "Result",
            value: `**${roll.total}**`,
          },
        ],
      },
    ],
  };
  sendWebhookMessage(JSON.stringify(jsonData));
}

function sendMessageStats({ maxValue, newValue, oldValue, profile, statName, stats }) {
  const currentHealth = stats.health.current || stats.health.max;
  const currentFocus = stats.focus.current || stats.focus.max;
  const currentKarma = stats.karma.current || stats.karma.max;
  const jsonData = {
    content: `${profile.name} updated ${statName}. ~~${oldValue} / ${maxValue}~~ => ${newValue} / ${maxValue}`,
    embeds: [
      {
        color: profile.color,
        description: "Stats",
        thumbnail: {
          url: profile.photoUrl,
        },
        fields: [
          {
            name: "Health",
            value: `${currentHealth}/${stats.health.max}`,
          },
          {
            name: "Focus",
            value: `${currentFocus}/${stats.focus.max}`,
          },
          {
            name: "Karma",
            value: `${currentKarma}/${stats.karma.max}`,
          },
        ],
      },
    ],
  };
  sendWebhookMessage(JSON.stringify(jsonData));
}

function getDieEmoji(value) {
  switch (value) {
    case 0:
      return "🟥";
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
    default:
      return null;
  }
}

function sendWebhookMessage(jsonMessage) {
  if (!_webhookUrl) return;

  fetch(_webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: jsonMessage,
  })
    .then((data) => console.log("Webhook Success:", data))
    .catch((error) => console.error("Webhook Error:", error));
}

export default {
  sendMessageAbility,
  sendMessageDamage,
  sendMessageInitiative,
  sendMessageStats,
  updateWebhookUrl,
};
