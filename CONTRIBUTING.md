# Working on the project

Use Node.js 22 or newer. There are no package dependencies to install.

```sh
npm run build
npm test
npm start
```

The preview address is printed when the server starts. The generated website is in `dist/`.

Question content lives in `questions.txt`. Each section declares its question count. Each question contains a familiar situation and three or four example replies. Preserve distinct choices, plain language, stable IDs, and the agreed section sizes. Do not add user answers, account credentials, or deployment-specific files to commits.

The application, offline page, and readable question reference are generated together. After an edit, rebuild and run the tests. Check keyboard navigation, a narrow phone layout, backup and restore, unanswered navigation, and downloaded results before publishing.

GitHub Pages publishes the generated `dist/` directory through the repository workflow. All application asset links are relative so the site works under a repository path.
