# Arabic Academy

**A free, open learning path for Arabic, with lessons, exercises, and progress tracking organised in one place.**

Arabic Academy grew out of a personal need: I want to learn Arabic without paying for a course or losing my way across dozens of separate resources.

The project is for anyone looking for a structured learning path and wanting to use Arabic in real life, including professional settings.

## Why I built it

There are plenty of free resources for learning Arabic online. The challenge I faced was bringing them together: one website for the alphabet, a video for pronunciation, a PDF for grammar, and exercises somewhere else. Figuring out what to study first, what comes next, and what to review becomes a task of its own.

I couldn’t find a free resource that brought everything together the way I needed: an organised path, accessible explanations, exercises to practise with, and a simple way to track my progress.

I also wanted an approach closer to practical and professional use of the language. Simple sentences help you learn the basics, but my goal isn’t to stop at “the horse drinks milk in the kitchen”: I want to understand information, read texts, and communicate in real situations.

So I started building the tool I wished I had found. Arabic Academy is the result of that work, and it is still evolving.

## What it offers

- **A learning path organised by level**, so you know where to start and how to move forward.
- **Lessons available directly on the website**, with explanations, examples, and tables.
- **Interactive exercises**, with automatic checking for constrained answers and reference models for open-ended responses.
- **Review activities and personal flashcards**, to revisit topics that need more practice.
- **Customisable notes, lessons, and exercises**, to adapt your studies to your needs.
- **Progress saved in your browser**, with backup export and import.

The course starts with the writing system and Modern Standard Arabic (MSA). Practical and professional use is the direction of the project: this does not mean every lesson is already specialised or that the course alone prepares you for a profession.

## Who it is for

Anyone who wants to start learning Arabic, anyone who has already collected materials but struggles to organise them, and anyone looking for a free place to study consistently.

You don’t need to share the professional or personal goals that led me to build it. If it helps you learn something, the project is already doing what it was created to do.

## Project status and limitations

The materials currently included cover **A0–B2**. Sections for **C1 and C2** are prepared for future additions; they are not yet complete courses.

The interface is available in **Italian and English**. Course explanations, exercise instructions, and solutions are currently in **Italian and Arabic**: selecting English does not translate all the learning materials.

**This project is not perfect, and it does not claim to be.** The content has not undergone a comprehensive linguistic review and may contain errors, unclear explanations, or activities that need improvement.

In particular:

- Automatic checking compares your response against expected answers and may not recognise every valid alternative.
- Open-ended responses require comparison with a model and self-assessment; they are not graded by a teacher or a language assessment system.
- Audio playback, when available, uses your device’s text-to-speech capabilities. It does not replace native-speaker recordings or conversation practice.
- Levels organise the material: completing the course does not amount to earning a language certification.

The website is a tool to support independent study. Feedback from knowledgeable speakers, listening, and real-world practice remain important.

## How to use it

Open the website using the address listed in the repository’s **About** section or under **Settings → Pages**. If you are starting from scratch, begin with **A0**: read the explanations, complete the exercises, and revisit topics that need more practice.

No account or subscription is required. In the GitHub Pages version, your progress and personal content are stored in the browser on the device you are using.

**Export a backup regularly from Settings.** Clearing your browser data may also erase your progress. To continue on another device, export your backup and import it there: devices do not sync automatically.

## Feedback, corrections, and contributions

Constructive criticism and corrections are welcome. You don’t have to agree with the project’s choices: what matters is helping identify what isn’t working and how to improve it.

To report an error, open an **Issue** and include:

1. The relevant level, lesson, and exercise.
2. The wording or behaviour you believe is incorrect.
3. Your proposed correction and the reasoning behind it.
4. A verifiable source or a documented linguistic explanation when reporting an issue with the learning materials.

If there are multiple acceptable forms, differences in register, or distinctions between Modern Standard Arabic and dialects, please specify them. The aim is to improve the material without replacing one inaccuracy with another.

Bug reports, accessibility improvements, translations, clearer explanations, and suggestions for practical activities are also useful. You can contribute through an Issue or a pull request. Please do not include backups, personal notes, or other private data in your reports.

## Why make it available to everyone?

I want my projects to be available to anyone who needs them. If I build something to solve a problem of my own and it can also help other people, sharing it makes sense to me.

Arabic Academy follows that idea: reducing barriers to learning and allowing others to use, improve, and develop the tool. You don’t need to pay to access the course, and you don’t need to contribute code to use it.

## Running locally

The website is built with **React, TypeScript, and Vite** and can be hosted on **GitHub Pages**, without an application server or API keys.

Requires Node.js 22.13 or later.

```bash
npm ci
npm run dev
```

To run the tests and create a production build:

```bash
npm test
npm run build
```

The build is generated in the `dist/` directory. The workflow in `.github/workflows/pages.yml` handles deployment to GitHub Pages after updates to the `main` branch, once Pages is configured to use **GitHub Actions** as its source.

## Licence

The application code is distributed under the **MIT licence**: see [LICENSE](LICENSE).

The code licence does not automatically grant the same rights to the learning materials. For information about the origin and distribution terms of the content, see [CONTENT-LICENSE.md](CONTENT-LICENSE.md).