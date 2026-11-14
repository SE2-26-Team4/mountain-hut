import { Form } from "react-bootstrap";

/** @param {{
 *   selectedHiker: import("../../models/models.js").HikerDTO | null,
 *   searchResults: import("../../models/models.js").HikerDTO[],
 *   hikerSearch: string,
 *   isSearching: boolean,
 *   searchMessage: string,
 *   onSearch: () => Promise<void>,
 *   onQueryChange: (value: string) => void,
 *   onSelect: (hiker: import("../../models/models.js").HikerDTO | null) => void,
 * }} props */
export default function ExistingHikerPicker({
  selectedHiker,
  searchResults,
  hikerSearch,
  isSearching,
  searchMessage,
  onSearch,
  onQueryChange,
  onSelect,
}) {
  return (
    <div className="mt-3">
      {selectedHiker ? (
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 rounded border p-3">
          <div>
            <strong className="d-block">{selectedHiker.fullName}</strong>
            {selectedHiker.email && (
              <small className="text-body-secondary">
                {selectedHiker.email}
              </small>
            )}
          </div>

          <button
            type="button"
            className="cap-outline"
            onClick={() => onSelect(null)}
          >
            Change hiker
          </button>
        </div>
      ) : (
        <>
          <Form.Label htmlFor="staff-hiker-search">Search hikers</Form.Label>

          <div className="d-flex gap-2">
            <Form.Control
              id="staff-hiker-search"
              type="search"
              placeholder="Name, email or phone"
              value={hikerSearch}
              maxLength={100}
              disabled={isSearching}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSearch();
                }
              }}
            />

            <button
              type="button"
              className="cap-primary"
              disabled={isSearching || hikerSearch.trim().length < 2}
              onClick={onSearch}
            >
              {isSearching ? "Searching…" : "Search"}
            </button>
          </div>

          {searchMessage && (
            <p className="mt-2 mb-0" role="status">
              {searchMessage}
            </p>
          )}

          {searchResults.length > 0 && (
            <>
              <p className="small text-body-secondary mt-3 mb-2">
                {searchResults.length}{" "}
                {searchResults.length === 1 ? "match shown" : "matches shown"}.
                Search by full name, email or phone to narrow the results.
              </p>

              <div
                className="list-group staff-hiker-results"
                aria-label="Hiker search results"
              >
                {searchResults.map((hiker) => (
                  <button
                    key={hiker.id}
                    type="button"
                    className="list-group-item list-group-item-action"
                    onClick={() => onSelect(hiker)}
                  >
                    <strong className="d-block">{hiker.fullName}</strong>
                    {hiker.email && (
                      <small className="text-body-secondary">
                        {hiker.email}
                      </small>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
