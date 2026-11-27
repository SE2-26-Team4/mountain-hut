/**
 * @typedef {{ id: string, name: string, ingredients: string,
 *   allergens: string[], imageId: string }} MenuDish
 * @typedef {{ type: "Set menu" | "À la carte", notes: string,
 *   dishes: MenuDish[] }} StaffMenu
 * @typedef {{ id: string, name: string, src: string }} MenuImage
 */

const menusKey = "mountain-hut.mock-menus.v1";
const imagesKey = "mountain-hut.mock-menu-images.v1";

export const allergenOptions = [
  "Cereals containing gluten",
  "Crustaceans",
  "Eggs",
  "Fish",
  "Peanuts",
  "Soybeans",
  "Milk",
  "Tree nuts",
  "Celery",
  "Mustard",
  "Sesame",
  "Sulphites",
  "Lupin",
  "Molluscs",
];

export function createDish() {
  return {
    id: crypto.randomUUID(),
    name: "",
    ingredients: "",
    allergens: /** @type {string[]} */ ([]),
    imageId: "",
  };
}

/** @returns {StaffMenu} */
export function createMenu() {
  return { type: "Set menu", notes: "", dishes: [createDish()] };
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

/** @returns {Record<string, StaffMenu>} */
export function readMockMenus() {
  return readStorage(menusKey, {});
}

/** @param {Record<string, StaffMenu>} menus */
export function saveMockMenus(menus) {
  localStorage.setItem(menusKey, JSON.stringify(menus));
}

/** @returns {MenuImage[]} */
export function readMockImages() {
  return readStorage(imagesKey, []);
}

/** @param {MenuImage[]} images */
export function saveMockImages(images) {
  localStorage.setItem(imagesKey, JSON.stringify(images));
}

/**
 * @type {{
 *   name: string,
 *   date: string,
 *   startTime: string,
 *   endTime: string,
 *   menu: StaffMenu,
 * }[]}
 */
export const previousMenus = [
  {
    name: "Lunch",
    date: "2026-12-02",
    startTime: "13:00",
    endTime: "14:00",
    menu: {
      type: "À la carte",
      notes: "Ask our staff about the **daily specials**.",
      dishes: [
        {
          id: "previous-pasta",
          name: "Pasta of the day",
          ingredients: "Wheat pasta, mountain cheese, sage",
          allergens: ["Cereals containing gluten", "Milk"],
          imageId: "",
        },
        {
          id: "previous-pizza",
          name: "Pizza of the day",
          ingredients: "Wheat dough, tomato, mozzarella",
          allergens: ["Cereals containing gluten", "Milk"],
          imageId: "",
        },
      ],
    },
  },
  {
    name: "Lunch",
    date: "2026-11-29",
    startTime: "12:00",
    endTime: "13:00",
    menu: {
      type: "Set menu",
      notes: "Bread and water are included.",
      dishes: [
        {
          id: "previous-soup",
          name: "Barley and vegetable soup",
          ingredients: "Barley, carrots, celery",
          allergens: ["Cereals containing gluten", "Celery"],
          imageId: "",
        },
        {
          id: "previous-polenta",
          name: "Polenta with mushrooms",
          ingredients: "Cornmeal, mushrooms",
          allergens: [],
          imageId: "",
        },
      ],
    },
  },
];
