/**
 * Helper function to select elements.
 * Pass a parent element to scope the search, otherwise it defaults to the whole document.
 */
const select = (selector, parent = document) => parent.querySelector(selector);

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const profileId = urlParams.get("c");

  if (!profileId) {
    console.warn("No character ID provided.");
    return;
  }

  try {
    const [tags, traits, powers, profile] = await Promise.all([
      fetch("./js/tags.json").then((res) => res.json()),
      fetch("./js/traits.json").then((res) => res.json()),
      fetch("./js/powers.json").then((res) => res.json()),
      fetch(`./js/profile-${profileId}.json`).then((res) => res.json()),
    ]);
    buildCharacterSheet(profile, tags, traits, powers);
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

function buildCharacterSheet(profile, tagsData, traitsData, powersData) {
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
  renderAbilities(profile.abilities);
  renderDamages(profile.damage);
  renderPowers(profile.powers, powersData);
}

function buildInitiative(initiative) {
  return `${initiative.value > 0 ? "+" : ""}${initiative.value}${initiative.edge ? "E" : ""}`;
}

function renderAbility(view, value) {
  select(".ability", view).textContent = value.ability;
  select(".defense", view).textContent = value.defense;
  select(".noncombat", view).textContent = `+${value.noncombat}`;
}

function renderAbilities(abilities) {
  renderAbility(select("#ability-row-melee"), abilities.melee);
  renderAbility(select("#ability-row-agility"), abilities.agility);
  renderAbility(select("#ability-row-resilience"), abilities.resilience);
  renderAbility(select("#ability-row-vigilance"), abilities.vigilance);
  renderAbility(select("#ability-row-ego"), abilities.ego);
  renderAbility(select("#ability-row-logic"), abilities.logic);
}

function renderDamage(view, damage) {
  select(".multiplier", view).textContent = `Marvel X ${damage.multiplier}`;
  select(".ability", view).textContent = damage.ability;
}

function renderDamages(damage) {
  const damageGrid = select("#damage-grid");
  renderDamage(select("#damage-row-melee", damageGrid), damage.melee);
  renderDamage(select("#damage-row-agility", damageGrid), damage.agility);
  renderDamage(select("#damage-row-ego", damageGrid), damage.ego);
  renderDamage(select("#damage-row-logic", damageGrid), damage.logic);
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

init();
