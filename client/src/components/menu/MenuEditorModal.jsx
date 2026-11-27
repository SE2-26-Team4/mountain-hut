import { useId, useState } from "react";
import { Alert, Button, Col, Form, Modal, Row } from "react-bootstrap";

import { formatBookingDate } from "../../utils/formatBookingDate.js";
import { formatMealTimeRange } from "../../utils/formatMealSlot.js";
import MenuEditor from "./MenuEditor.jsx";
import MenuMarkdown from "./MenuMarkdown.jsx";
import StatusBadge from "../common/StatusBadge.jsx";
import {
  allergenOptions,
  createDish,
  createMenu,
  previousMenus,
  readMockImages,
  readMockMenus,
  saveMockImages,
} from "./menu-mock.js";

/** @typedef {import("./menu-mock.js").StaffMenu} StaffMenu */
/** @typedef {import("./menu-mock.js").MenuDish} MenuDish */
/** @typedef {import("./menu-mock.js").MenuImage} MenuImage */

/**
 * @param {{
 *   slot: import("../../API/capacity-api.js").ConfiguredMealSlot,
 *   date: string,
 *   initialMenu?: StaffMenu,
 *   onHide: () => void,
 *   onSave: (menu: StaffMenu) => void,
 * }} props
 */
export default function MenuEditorModal({
  slot,
  date,
  initialMenu,
  onHide,
  onSave,
}) {
  const titleId = useId();
  const [draft, setDraft] = useState(() => initialMenu ?? createMenu());
  const [notesRevision, setNotesRevision] = useState(0);
  const [match, setMatch] = useState("name");
  const [order, setOrder] = useState("recent");
  const [beforeReuse, setBeforeReuse] = useState(
    /** @type {StaffMenu | null} */ (null),
  );
  const [images, setImages] = useState(readMockImages);
  const [photoDishId, setPhotoDishId] = useState("");
  const [selectedImageId, setSelectedImageId] = useState("");
  const [imageToDelete, setImageToDelete] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");

  const timeRange = formatMealTimeRange(slot.startTime, slot.endTime);
  const selectedDate = formatBookingDate(date);
  const slotName = slot.name.trim().toLowerCase();
  const [customAllergens, setCustomAllergens] = useState(
    /** @type {string[]} */ ([]),
  );

  const availableAllergens = [
    ...new Set([
      ...allergenOptions,
      ...customAllergens,
      ...draft.dishes.flatMap((dish) => dish.allergens),
    ]),
  ];

  const source = previousMenus
    .filter((item) => {
      if (item.date >= date) return false;
      if (match === "any") return true;
      if (item.name.toLowerCase() !== slotName) return false;

      return (
        match !== "exact" ||
        (item.startTime === slot.startTime && item.endTime === slot.endTime)
      );
    })
    .sort((a, b) =>
      order === "recent"
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date),
    )[0];

  const namedDishes = draft.dishes.filter((dish) => dish.name.trim());
  const photosById = new Map(images.map((image) => [image.id, image]));
  const showPhotos =
    namedDishes.length > 0 &&
    namedDishes.every((dish) => photosById.has(dish.imageId));

  /**
   * @param {string} id
   * @param {Partial<MenuDish>} changes
   */
  function updateDish(id, changes) {
    setDraft((current) => ({
      ...current,
      dishes: current.dishes.map((dish) =>
        dish.id === id ? { ...dish, ...changes } : dish,
      ),
    }));
  }

  /** @param {StaffMenu} menu */
  function replaceDraft(menu) {
    setDraft(menu);
    setNotesRevision((revision) => revision + 1);
    setError("");
  }

  function reuseMenu() {
    if (!source) return;

    setBeforeReuse(draft);
    replaceDraft({
      ...source.menu,
      dishes: source.menu.dishes.map((dish) => ({
        ...dish,
        id: crypto.randomUUID(),
        allergens: [...dish.allergens],
      })),
    });
  }

  /** @param {MenuDish} dish */
  function openLibrary(dish) {
    setPhotoDishId(dish.id);
    setSelectedImageId(dish.imageId);
    setImageToDelete("");
    setImageError("");
  }

  /** @param {MenuImage[]} nextImages */
  function storeImages(nextImages) {
    try {
      saveMockImages(nextImages);
      setImages(nextImages);
      setImageError("");
      return true;
    } catch {
      setImageError("The browser could not save the image library.");
      return false;
    }
  }

  /** @param {File} file */
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("The file could not be read."));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** @param {import("react").ChangeEvent<HTMLInputElement>} event */
  async function uploadImage(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 500 * 1024
    ) {
      setImageError("Choose a JPG, PNG or WebP image up to 500 KB.");
      return;
    }

    setUploading(true);
    try {
      const src = await readImage(file);
      const image = { id: crypto.randomUUID(), name: file.name, src };
      if (storeImages([...images, image])) setSelectedImageId(image.id);
    } catch {
      setImageError("The image could not be read.");
    } finally {
      setUploading(false);
    }
  }

  function deleteImage() {
    const usedBySavedMenu = Object.values(readMockMenus()).some((menu) =>
      menu.dishes.some((dish) => dish.imageId === imageToDelete),
    );
    const usedByDraft = draft.dishes.some(
      (dish) => dish.imageId === imageToDelete,
    );

    if (usedBySavedMenu || usedByDraft) {
      setImageError(
        "Remove this photo from the menus that use it before deleting it.",
      );
      setImageToDelete("");
      return;
    }

    if (storeImages(images.filter((image) => image.id !== imageToDelete))) {
      if (selectedImageId === imageToDelete) setSelectedImageId("");
      setImageToDelete("");
    }
  }

  function saveMenu() {
    const unnamedDishIndex = draft.dishes.findIndex(
      (dish) =>
        !dish.name.trim() &&
        (dish.ingredients.trim() || dish.allergens.length > 0 || dish.imageId),
    );

    if (unnamedDishIndex !== -1) {
      setError(
        `Enter a name for dish ${unnamedDishIndex + 1} or remove it before saving.`,
      );
      return;
    }
    if (!namedDishes.length && !draft.notes.trim()) {
      setError("Add at least one dish or write a menu note.");
      return;
    }

    try {
      onSave({ ...draft, dishes: namedDishes });
    } catch {
      setError(
        "The browser could not save this menu. Your draft is still open.",
      );
    }
  }

  return (
    <>
      <Modal
        show
        size="xl"
        centered
        scrollable
        onHide={onHide}
        aria-labelledby={titleId}
        dialogClassName="mh-staff-menu-dialog"
      >
        <Modal.Header closeButton>
          <Modal.Title id={titleId}>
            {initialMenu ? "Edit menu" : "Add menu"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="bg-body-tertiary rounded p-3 mb-3">
            <div className="text-secondary small">Selected time slot</div>
            <strong>
              {slot.name} · {selectedDate} · {timeRange}
            </strong>
          </div>

          <section
            className="mh-staff-menu-reuse cap-previous-configuration mb-3"
            aria-label="Previous menu"
          >
            <span className="cap-table-symbol" aria-hidden="true">
              <i className="bi bi-clock-history" />
            </span>

            <div className="flex-grow-1">
              <h3 className="h6 mb-2">Previous menu</h3>

              <div className="cap-reuse-controls">
                <Form.Group controlId={`${titleId}-match`}>
                  <Form.Label className="small mb-1">
                    Match previous slot
                  </Form.Label>
                  <Form.Select
                    value={match}
                    onChange={(event) => setMatch(event.target.value)}
                  >
                    <option value="name">Same name, any time</option>
                    <option value="exact">Same name and time</option>
                    <option value="any">Any service</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group controlId={`${titleId}-order`}>
                  <Form.Label className="small mb-1">Menu order</Form.Label>
                  <Form.Select
                    value={order}
                    onChange={(event) => setOrder(event.target.value)}
                  >
                    <option value="recent">Most recent</option>
                    <option value="oldest">Oldest first</option>
                  </Form.Select>
                </Form.Group>

                <button
                  type="button"
                  className="cap-primary"
                  disabled={!source}
                  onClick={reuseMenu}
                >
                  <i className="bi bi-arrow-repeat" aria-hidden="true" />
                  Reuse menu
                </button>
              </div>

              <p className="small text-secondary mt-2 mb-0" role="status">
                {source
                  ? `From ${source.name} · ${formatBookingDate(source.date)} · ${formatMealTimeRange(source.startTime, source.endTime)} · ${source.menu.type}`
                  : "No previous menus match these criteria."}
              </p>

              {beforeReuse && (
                <div className="d-flex align-items-center gap-2 mt-2">
                  <span className="small text-success" role="status">
                    Menu copied into this draft.
                  </span>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      replaceDraft(beforeReuse);
                      setBeforeReuse(null);
                    }}
                  >
                    Undo
                  </Button>
                </div>
              )}
            </div>
          </section>

          <fieldset className="mb-3">
            <legend className="h6">Menu type</legend>
            {
              /** @type {const} */ (["Set menu", "À la carte"]).map(
                (type, index) => (
                  <Form.Check
                    key={type}
                    inline
                    type="radio"
                    name={`${titleId}-menu-type`}
                    id={`${titleId}-type-${index}`}
                    label={type}
                    checked={draft.type === type}
                    onChange={() =>
                      setDraft((current) => ({ ...current, type }))
                    }
                  />
                ),
              )
            }
          </fieldset>

          <Row className="g-3">
            <Col md={7}>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h3 className="h6 mb-0">Dishes</h3>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    const dish = createDish();
                    setDraft((current) => ({
                      ...current,
                      dishes: [...current.dishes, dish],
                    }));
                  }}
                >
                  + Add dish
                </Button>
              </div>

              {draft.dishes.map((dish, index) => (
                <fieldset key={dish.id} className="mh-staff-menu-dish mb-2">
                  <legend className="small fw-semibold">
                    Dish {index + 1}
                  </legend>

                  <Form.Group controlId={`name-${dish.id}`} className="mb-2">
                    <Form.Label className="small mb-1">Dish name</Form.Label>
                    <Form.Control
                      value={dish.name}
                      onChange={(event) =>
                        updateDish(dish.id, { name: event.target.value })
                      }
                    />
                  </Form.Group>

                  <Form.Group
                    controlId={`ingredients-${dish.id}`}
                    className="mb-2"
                  >
                    <Form.Label className="small mb-1">Ingredients</Form.Label>
                    <Form.Control
                      value={dish.ingredients}
                      onChange={(event) =>
                        updateDish(dish.id, { ingredients: event.target.value })
                      }
                    />
                  </Form.Group>

                  <details className="mb-2">
                    <summary>
                      {dish.allergens.length
                        ? `Allergens · ${dish.allergens.join(", ")}`
                        : "Select allergens"}
                    </summary>

                    {dish.allergens.length > 0 && (
                      <p className="small text-secondary mt-2 mb-0">
                        {dish.allergens.join(", ")}
                      </p>
                    )}
                    <div className="mh-staff-menu-allergens pt-2">
                      {availableAllergens.map((allergen, allergenIndex) => (
                        <Form.Check
                          key={allergen}
                          id={`allergen-${dish.id}-${allergenIndex}`}
                          label={allergen}
                          checked={dish.allergens.includes(allergen)}
                          onChange={(event) =>
                            updateDish(dish.id, {
                              allergens: event.currentTarget.checked
                                ? [...dish.allergens, allergen]
                                : dish.allergens.filter(
                                    (value) => value !== allergen,
                                  ),
                            })
                          }
                        />
                      ))}
                    </div>
                    <Form
                      className="d-flex flex-wrap align-items-end gap-2 mt-3"
                      onSubmit={(event) => {
                        event.preventDefault();

                        const form = event.currentTarget;
                        const name = String(
                          new FormData(form).get("allergen") ?? "",
                        )
                          .trim()
                          .replace(/\s+/g, " ");

                        if (!name) return;

                        const existing = availableAllergens.find(
                          (option) =>
                            option.toLowerCase() === name.toLowerCase(),
                        );
                        const allergen = existing ?? name;

                        if (!existing) {
                          setCustomAllergens((current) => [
                            ...current,
                            allergen,
                          ]);
                        }

                        if (!dish.allergens.includes(allergen)) {
                          updateDish(dish.id, {
                            allergens: [...dish.allergens, allergen],
                          });
                        }

                        form.reset();
                      }}
                    >
                      <Form.Group
                        controlId={`custom-allergen-${dish.id}`}
                        className="flex-grow-1"
                      >
                        <Form.Label className="small mb-1">
                          New allergen
                        </Form.Label>
                        <Form.Control
                          name="allergen"
                          placeholder="e.g. Kiwi"
                          size="sm"
                          maxLength={60}
                          required
                        />
                      </Form.Group>

                      <Button
                        type="submit"
                        variant="outline-secondary"
                        size="sm"
                      >
                        + Add allergen
                      </Button>
                    </Form>
                  </details>

                  <div className="d-flex align-items-center gap-2 flex-wrap mt-3">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => openLibrary(dish)}
                    >
                      {dish.imageId ? "Change photo" : "Choose photo"}
                    </Button>
                    {dish.imageId && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => updateDish(dish.id, { imageId: "" })}
                      >
                        Remove photo
                      </Button>
                    )}
                  </div>
                  <div className="d-flex justify-content-end mt-2">
                    <Button
                      variant="outline-danger"
                      size="sm"
                      aria-label={`Remove dish ${index + 1}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          dishes: current.dishes.filter(
                            (item) => item.id !== dish.id,
                          ),
                        }))
                      }
                    >
                      Remove dish
                    </Button>
                  </div>
                </fieldset>
              ))}

              <details className="mt-3">
                <summary className="fw-semibold mb-2">
                  Menu notes (optional)
                </summary>
                <MenuEditor
                  key={notesRevision}
                  initialContent={draft.notes}
                  onChange={(notes) =>
                    setDraft((current) => ({ ...current, notes }))
                  }
                  showPreview={false}
                />
              </details>
            </Col>

            <Col md={5}>
              <h3 className="h6 mb-2">Public preview</h3>
              <div className="mh-staff-menu-preview">
                <div className="mh-staff-menu-preview-heading">
                  <strong>{slot.name}</strong>
                  <div className="small">
                    {selectedDate} · {timeRange}
                  </div>
                </div>

                <div className="p-3">
                  <div className="mh-staff-menu-type-badge mb-2">
                    <StatusBadge>{draft.type}</StatusBadge>
                  </div>
                  {draft.type === "Set menu" && (
                    <p className="small text-secondary mt-1 mb-2">
                      All listed courses are included.
                    </p>
                  )}

                  {draft.notes.trim() && (
                    <div className="mt-2">
                      <MenuMarkdown content={draft.notes} />
                    </div>
                  )}

                  {namedDishes.length ? (
                    <ul className="list-unstyled mb-0 mt-2">
                      {namedDishes.map((dish) => {
                        const photo = showPhotos
                          ? photosById.get(dish.imageId)
                          : undefined;
                        return (
                          <li
                            key={dish.id}
                            className="mh-staff-menu-preview-dish"
                          >
                            <div>
                              <div>
                                <strong>{dish.name}</strong>

                                {dish.ingredients && (
                                  <div className="small text-secondary">
                                    Ingredients: {dish.ingredients}
                                  </div>
                                )}

                                {dish.allergens.length > 0 && (
                                  <div className="mh-staff-menu-allergen small">
                                    Allergens: {dish.allergens.join(", ")}
                                  </div>
                                )}
                              </div>
                            </div>
                            {photo && (
                              <img
                                className="mh-staff-menu-thumbnail"
                                src={photo.src}
                                alt={dish.name}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="small text-secondary mt-2 mb-0">
                      Your dishes will appear here.
                    </p>
                  )}
                </div>
              </div>

              {namedDishes.some((dish) => dish.imageId) && !showPhotos && (
                <p className="small text-secondary mt-2">
                  Add a photo to every dish to show photos in the public
                  preview.
                </p>
              )}
            </Col>
          </Row>

          {error && (
            <Alert variant="danger" className="mt-3 mb-0">
              {error}
            </Alert>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button
            type="button"
            className="mh-staff-menu-footer-primary"
            onClick={saveMenu}
          >
            Save menu
          </Button>
        </Modal.Footer>
      </Modal>

      {photoDishId && (
        <Modal
          show
          centered
          scrollable
          className="mh-staff-menu-library"
          dialogClassName="mh-staff-menu-library-dialog"
          backdropClassName="mh-staff-menu-library-backdrop"
          onHide={() => setPhotoDishId("")}
          aria-labelledby={`${titleId}-library`}
        >
          <Modal.Header closeButton>
            <Modal.Title id={`${titleId}-library`}>Image library</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Form.Group controlId={`${titleId}-upload`} className="mb-3">
              <Form.Label>Upload image</Form.Label>
              <Form.Control
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-describedby={`${titleId}-upload-help`}
                disabled={uploading}
                onChange={uploadImage}
              />
              <Form.Text id={`${titleId}-upload-help`}>
                JPG, PNG or WebP · Max. 500 KB per image. Recommended: 800 × 560
                px, landscape.
              </Form.Text>
            </Form.Group>

            {images.length === 0 && (
              <p className="text-secondary">No images in the library yet.</p>
            )}

            {images.map((image) => (
              <div
                key={image.id}
                className="d-flex align-items-center gap-2 border-bottom py-2"
              >
                <img
                  className="mh-staff-menu-thumbnail"
                  src={image.src}
                  alt=""
                />
                <Form.Check
                  type="radio"
                  name={`${titleId}-image`}
                  id={`image-${image.id}`}
                  label={image.name}
                  checked={selectedImageId === image.id}
                  onChange={() => setSelectedImageId(image.id)}
                  className="flex-grow-1 text-break"
                />
                <Button
                  variant="outline-danger"
                  size="sm"
                  disabled={uploading}
                  onClick={() => {
                    setImageError("");
                    setImageToDelete(image.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}

            {imageToDelete && (
              <Alert variant="warning" className="mt-3 mb-0">
                <p>
                  Delete {photosById.get(imageToDelete)?.name} from the library?
                </p>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="me-2"
                  onClick={() => setImageToDelete("")}
                >
                  Keep image
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={uploading}
                  onClick={deleteImage}
                >
                  Delete image
                </Button>
              </Alert>
            )}

            {imageError && (
              <Alert variant="danger" className="mt-3 mb-0">
                {imageError}
              </Alert>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setPhotoDishId("")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="mh-staff-menu-footer-primary"
              disabled={uploading || !photosById.has(selectedImageId)}
              onClick={() => {
                updateDish(photoDishId, { imageId: selectedImageId });
                setPhotoDishId("");
              }}
            >
              Use selected image
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
