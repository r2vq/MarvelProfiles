/**
 * Helper function to select elements.
 * Pass a parent element to scope the search, otherwise it defaults to the whole document.
 */
const select = (selector, parent = document) => parent.querySelector(selector);

export { select };
