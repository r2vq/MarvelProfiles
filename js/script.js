const tags = await fetch("./js/tags.json").then((response) => response.json());
const traits = await fetch("./js/traits.json").then((response) => response.json());
const powers = await fetch("./js/powers.json").then((response) => response.json());

const urlParams = new URLSearchParams(window.location.search);
const profileId = urlParams.get("c");

const profile = await fetch(`./js/profile-${profileId}.json`).then((response) => response.json());

const select = function(selector) {
    return document.querySelector(selector);
};

HTMLElement.prototype.select = function (selector) {
  return this.querySelector(selector);
};

(() => {
  function main() {
    select("#character-name").innerText = profile.name;
    select("#secret-identity").innerText = profile.secretIdentity;
    select("#character-photo").src = profile.photoUrl;

    select("#stat-rank > .value").innerText = profile.rank;
    select("#stat-karma > .value").innerText = profile.karma;
    select("#stat-health > .value").innerText = profile.health;
    select("#stat-focus > .value").innerText = profile.focus;
    select("#stat-init > .value").innerText = buildInitiative(profile.initiative);

    select("body").className = profile.theme;

    renderTraits(profile.traits);
    renderTags(profile.tags);

    renderAbilities(profile.abilities);
    renderDamages(profile.damage);
    renderPowers(profile.powers);
  }

  function buildInitiative(initiative) {
    return `${initiative.value > 0 ? "+" : ""}${initiative.value}${initiative.edge ? "E" : ""}`;
  }

  function renderAbility(view, value) {
    view.select(".ability").innerText = value.ability;
    view.select(".defense").innerText = value.defense;
    view.select(".noncombat").innerText = `+${value.noncombat}`;
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
    view.querySelector(".multiplier").innerText = damage.multiplier;
    view.querySelector(".ability").innerText = damage.ability;
  }

  function renderDamages(damage) {
    const damageGrid = select("#damage-grid");
    renderDamage(damageGrid.select("#damage-row-melee"), damage.melee);
    renderDamage(damageGrid.select("#damage-row-agility"), damage.agility);
    renderDamage(damageGrid.select("#damage-row-ego"), damage.ego);
    renderDamage(damageGrid.select("#damage-row-logic"), damage.logic);
  }

  function renderPowers(characterPowers) {
    const powersGrid = select("#powers-grid");
    characterPowers.forEach((i) => {
      const power = powers[i];

      const rowTitle = document.createElement("div");
      rowTitle.classList.add("label");
      rowTitle.classList.add("power-name");
      rowTitle.innerHTML = power.name;

      const rowDescription = document.createElement("div");
      rowDescription.classList.add("power-desc");
      rowDescription.innerHTML = power.text;

      const rowFocus = document.createElement("div");
      rowFocus.classList.add("power-focus");
      rowFocus.innerHTML = `${power.cost == 0 ? "--" : power.cost}`;

      const gridRow = document.createElement("div");
      gridRow.classList.add("content");
      gridRow.appendChild(rowTitle);
      gridRow.appendChild(rowFocus);
      gridRow.appendChild(rowDescription);

      powersGrid.appendChild(gridRow);
    });
  }

  function renderTags(characterTags) {
    const tagsGrid = select("#tags-grid");
    characterTags.forEach((i) => {
      const tag = tags[i];

      const rowTitle = document.createElement("div");
      rowTitle.classList.add("tag-label");
      rowTitle.innerHTML = tag.name;

      const rowDescription = document.createElement("div");
      rowDescription.classList.add("tag-value");
      rowDescription.innerHTML = tag.value;

      const gridRow = document.createElement("div");
      gridRow.classList.add("content");
      gridRow.appendChild(rowTitle);
      gridRow.appendChild(rowDescription);

      tagsGrid.appendChild(gridRow);
    });
  }

  function renderTraits(characterTraits) {
    const traitsGrid = select("#traits-grid");
    characterTraits.forEach((i) => {
      const trait = traits[i];

      const rowTitle = document.createElement("div");
      rowTitle.classList.add("trait-label");
      rowTitle.innerHTML = trait.name;

      const rowDescription = document.createElement("div");
      rowDescription.classList.add("trait-value");
      rowDescription.innerHTML = trait.value;

      const gridRow = document.createElement("div");
      gridRow.classList.add("content");
      gridRow.appendChild(rowTitle);
      gridRow.appendChild(rowDescription);

      traitsGrid.appendChild(gridRow);
    });
  }

  main();
})();
