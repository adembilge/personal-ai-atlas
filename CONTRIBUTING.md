# Working on the project

Use Node.js 22 or newer. There are no package dependencies to install.

```sh
npm run build
npm test
npm start
```

The preview address is printed when the server starts. The generated website is in `dist/`.

Question content lives in `questions.json`. Preserve the supplied wording, stable IDs, selection types, stage structure, and scenario metadata. Do not add user answers or credentials to commits.

The application, offline page, and readable question reference are generated together. After an edit, rebuild and run the tests. Check keyboard navigation, a narrow phone layout, backup and restore, unanswered navigation, and downloaded results before publishing.

Appearance is independent of questionnaire answers. Keep the current answer storage key and versioned formats stable. The appearance script runs in the document head to avoid a theme flash; test both device-following and explicit choices. DM Sans is bundled under its accompanying SIL Open Font License in `src/assets/`, and the offline build embeds the font.

GitHub Pages publishes the generated `dist/` directory through the repository workflow. All application asset links are relative so the site works under a repository path.
