# Client

Frontend of the Mountain Hut web app, built with [React](https://react.dev/) and [Vite](https://vite.dev/).

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`

## Commands

Run from the `client/` folder:

| Command           | Description                                      |
| ----------------- | ------------------------------------------------ |
| `npm install`     | Install dependencies                             |
| `npm run dev`     | Start the dev server at http://localhost:5173    |
| `npm run build`   | Build the production bundle into `client/dist`   |
| `npm run preview` | Serve the production build locally               |
| `npm run lint`    | Run ESLint                                       |

During development, requests to `/api/*` are proxied to the backend at
`http://localhost:8080` (see `vite.config.js`).
