function calculateDamage({ damageAbilityScore, damageMultiplier, damageReduction, die1, die2, die3 }) {
  const reducedMultiplier = damageMultiplier - damageReduction;
  const doesDamage = reducedMultiplier > 0;
  if (!doesDamage) return 0;

  const diceTotal = die1.value + die2.value + die3.value;
  const baseTotal = diceTotal * reducedMultiplier + damageAbilityScore;
  const isMarvel = die2.isMarvel;
  if (!isMarvel) return baseTotal;

  return baseTotal * 2;
}

function rerollAbility({ abilityScore, originalRoll, rerollPoisition }) {
  const die1 = rerollPoisition === 1 ? rollD6() : originalRoll.die1;
  const die2 = rerollPoisition === 2 ? rollDMarvel() : originalRoll.die2;
  const die3 = rerollPoisition === 3 ? rollD6() : originalRoll.die3;
  const total = die1.value + die2.value + die3.value + abilityScore;

  return { die1, die2, die3, total };
}

function rerollDamage({
  abilityScore,
  damageAbilityScore,
  damageMultiplier,
  damageReduction,
  originalRoll,
  rerollPoisition,
}) {
  const die1 = rerollPoisition === 1 ? rollD6() : originalRoll.die1;
  const die2 = rerollPoisition === 2 ? rollDMarvel() : originalRoll.die2;
  const die3 = rerollPoisition === 3 ? rollD6() : originalRoll.die3;
  const total = die1.value + die2.value + die3.value + abilityScore;
  const totalDamage = calculateDamage({ damageAbilityScore, damageMultiplier, damageReduction, die1, die2, die3 });

  return { die1, die2, die3, total, totalDamage };
}

function rerollInitiative({ initiativeModifier, originalRoll, rerollPoisition }) {
  const die1 = rerollPoisition === 1 ? rollD6() : originalRoll.die1;
  const die2 = rerollPoisition === 2 ? rollDMarvel() : originalRoll.die2;
  const die3 = rerollPoisition === 3 ? rollD6() : originalRoll.die3;
  const total = die1.value + die2.value + die3.value + initiativeModifier.value;

  return { die1, die2, die3, total };
}

function rollAbility({ abilityScore }) {
  const die1 = rollD6();
  const die2 = rollDMarvel();
  const die3 = rollD6();
  const total = die1.value + die2.value + die3.value + abilityScore;

  return { die1, die2, die3, total };
}

function rollD6() {
  const value = Math.floor(Math.random() * 6) + 1;
  const text = `${value}`;
  const isMarvel = false;
  return { isMarvel, text, value };
}

function rollDamage({ abilityScore, damageAbilityScore, damageMultiplier, damageReduction }) {
  const die1 = rollD6();
  const die2 = rollDMarvel();
  const die3 = rollD6();
  const total = die1.value + die2.value + die3.value + abilityScore;
  const totalDamage = calculateDamage({ damageAbilityScore, damageMultiplier, damageReduction, die1, die2, die3 });

  return { die1, die2, die3, total, totalDamage };
}

function rollDMarvel() {
  const die = rollD6();
  const rawValue = die.value;
  const isMarvel = rawValue === 1;
  const text = isMarvel ? "M" : `${die.text}`;
  const value = isMarvel ? 6 : die.value;

  return { isMarvel, text, value };
}

function rollInitiative({ initiativeModifier }) {
  const die1 = rollD6();
  const die2 = rollDMarvel();
  const die3 = rollD6();
  const total = die1.value + die2.value + die3.value + initiativeModifier.value;

  return { die1, die2, die3, total };
}

export default {
  rerollAbility,
  rerollDamage,
  rerollInitiative,
  rollD6,
  rollAbility,
  rollDamage,
  rollDMarvel,
  rollInitiative,
};
