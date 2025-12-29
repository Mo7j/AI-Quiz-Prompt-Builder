# AI Quiz Prompt Builder

A small web tool to build a robust prompt for your AI model, paste the model’s JSON quiz output, validate it, and render a practice quiz with instant feedback.

## How it works
1) Set quiz options (total questions, difficulty, include T/F).
2) Click **Build Prompt**, then copy it into your AI model along with your PDF/file.
3) After the model returns JSON, click **Paste JSON** (or paste manually) into the response box.
4) Click **Render Quiz** to validate the JSON and practice with the generated questions.

## Try it live
- Demo: [https://ai-quiz-prompt-builder.netlify.app/](https://ai-quiz-prompt-builder.netlify.app/)

## Why this exists
- Provides a clean, repeatable prompt for quiz generation.
- Enforces strict JSON validation so bad AI responses fail fast.
- Lets you practice immediately with auto-marked questions and feedback.

![Demo screenshot](demo.png)
