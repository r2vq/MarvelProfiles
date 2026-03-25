const clearCustomProfile = () => localStorage.removeItem("customProfile");

const clearProfileId = () => localStorage.removeItem("profileId");

const clearWebhookUrl = () => localStorage.removeItem("webhookUrl");

const getCustomProfile = () => localStorage.getItem("customProfile");

const getSavedFocus = () => localStorage.getItem(`${localStorage.getItem("profileId")}_focus`);

const getSavedHealth = () => localStorage.getItem(`${localStorage.getItem("profileId")}_health`);

const getSavedKarma = () => localStorage.getItem(`${localStorage.getItem("profileId")}_karma`);

const getSavedProfileId = () => localStorage.getItem("profileId");

const getSavedWebhookUrl = () => localStorage.getItem("webhookUrl");

const saveCustomProfile = ({ jsonString }) => localStorage.setItem("customProfile", jsonString);

const updateFocus = ({ newValue }) => localStorage.setItem(`${localStorage.getItem("profileId")}_focus`, newValue);

const updateHealth = ({ newValue }) => localStorage.setItem(`${localStorage.getItem("profileId")}_health`, newValue);

const updateKarma = ({ newValue }) => localStorage.setItem(`${localStorage.getItem("profileId")}_karma`, newValue);

const updateProfileId = ({ newValue }) => localStorage.setItem("profileId", newValue);

const updateWebhookUrl = ({ newValue }) => localStorage.setItem("webhookUrl", newValue);

export default {
  clearProfileId,
  clearWebhookUrl,
  getSavedFocus,
  getSavedHealth,
  getSavedKarma,
  getSavedProfileId,
  getSavedWebhookUrl,
  updateFocus,
  updateHealth,
  updateKarma,
  updateProfileId,
  updateWebhookUrl,
  clearCustomProfile,
  getCustomProfile,
  saveCustomProfile,
};
