# Kitchen Master

One app to run a kitchen: recipes, weekly set menus, guest numbers, allergen checks, stock takes, waste and production, and a Brakes food order you can approve.

Built for a real hotel and conference-centre kitchen that runs set menus, to replace an old, slow system. Runs on Windows and tablet in any modern browser. No install and no build step.

## Modules

| Module | Status | What it does |
| --- | --- | --- |
| **The Source** | Live | Recipe book laid out like the printed work sheet. Scales to any number of portions, lists Brakes codes, tracks 14 allergens |
| **Menu Planner** | Live | Pick each day's lunch and dinner from The Source, set guest numbers and how many of each dish to cook, with allergen tags on every dish |
| Allergen Check | Planned | Cross-reference each group's allergies against the menu and flag concerns |
| Stock Take | Planned | Manual counts against expected amounts |
| Waste & Produced | Planned | Log waste and production so stock stays accurate |
| Brakes Order | Planned | Total ingredients by Brakes code, minus stock, approve and copy into the portal |

## Run it

Open `index.html` in Chrome or Edge. That is all.

Recipes are saved in the browser on that device. The first time it opens it loads the 50 starter recipes from `data/recipes.json`.

## Project layout

```
index.html              page shell and module tabs
css/styles.css          all styling, light and dark
js/nav.js               module tab switching
js/modules/source.js    The Source (recipe book)
js/modules/planner.js   Menu Planner
js/data/menu.seed.js    sample week for the planner
js/data/recipes.seed.js starter recipes, generated
data/recipes.json       starter recipes (edit this one)
tools/build-seed.js     rebuilds the seed file from the JSON
tools/build-single.js   builds dist/kitchen-master.html, one self-contained file
dist/kitchen-master.html  single-file copy you can email or put on a tablet
```

After editing `data/recipes.json`, run `node tools/build-seed.js`. Clear the site's data in the browser to reload the starter recipes.

## About the data

The recipes are invented for a sample week, Monday to Saturday plus Sunday lunch. Product names and codes are modelled on Brakes ordering. Codes starting with `9` are placeholders, so swap in real codes from the portal. Allergens are pre-filled but marked unconfirmed until a chef checks them against the product labels. Nutrition is left blank on purpose.
