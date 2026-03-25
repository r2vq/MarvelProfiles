import storageManager from "./storage-manager.mjs";

async function getProfile(urlParams) {
  const customProfileRaw = storageManager.getCustomProfile();
  if (customProfileRaw) {
    try {
      return JSON.parse(customProfileRaw);
    } catch (e) {
      console.error("Error parsing custom profile. Falling back to default logic.", e);
      storageManager.clearCustomProfile();
    }
  }

  if (urlParams === null) {
    console.warn("No urlParams passed in to ProfileManager");
    return null;
  }

  let profileId = urlParams.get("c") || storageManager.getSavedProfileId();

  if (!profileId) {
    profileId = prompt("Please enter your profile id:", "");
  }

  if (!profileId) {
    console.warn("No profileId found");
    return null;
  }

  let profile = null;
  if (profileId) {
    try {
      profile = await fetch(`./data/profile-${profileId}.json`).then((res) => res.json());
    } catch (error) {
      console.error("Failed to load profile:", error);
      return null;
    }
  }

  if (!profile) {
    console.warn(`No character with ID: ${profileId} found.`);
    storageManager.clearProfileId();
    return null;
  }

  storageManager.updateProfileId({ newValue: profileId });
  return profile;
}

export default { getProfile };
