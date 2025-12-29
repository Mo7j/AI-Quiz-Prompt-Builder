document.addEventListener('DOMContentLoaded', () => {
  const totalQuestionsEl = document.getElementById('totalQuestions');
  const totalQuestionsValueEl = document.getElementById('totalQuestionsValue');
  const difficultyEl = document.getElementById('difficulty');
  const trueFalseEl = document.getElementById('trueFalse');

  const buildPromptBtn = document.getElementById('buildPromptBtn');
  const copyPromptBtn = document.getElementById('copyPromptBtn');
  const pasteJsonBtn = document.getElementById('pasteJsonBtn');
  const promptBox = document.getElementById('promptBox');

  const aiResponse = document.getElementById('aiResponse');
  const renderBtn = document.getElementById('renderBtn');
  const resultsEl = document.getElementById('results');
  const toastEl = document.getElementById('toast');

  // ---------- UI helpers ----------
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function clampInt(value, min, max) {
    const n = Number.parseInt(String(value), 10);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  totalQuestionsEl.addEventListener('input', () => {
    totalQuestionsValueEl.textContent = totalQuestionsEl.value;
  });

  // ---------- Prompt builder ----------
  function buildPrompt() {
    const totalQuestions = clampInt(totalQuestionsEl.value, 1, 500);
    const difficulty = difficultyEl.value;
    const includeTF = !!trueFalseEl.checked;

    const tfRule = includeTF
      ? `You MAY include true/false questions as part of the TOTAL (0%–25%). If you include a true/false question, set "type" to "true_false", set "options" to exactly ["True","False"], set "correct_index" to 0 or 1, and include feedback keys "0","1","correct" (all non-empty). Do NOT force TF per section.`
      : `Do NOT include any true/false questions. Every question must have "type": "mcq".`;

    const prompt = [
      `You will be given a file (PDF/Doc/Slides). Read the file content and generate a quiz that is answerable ONLY from that file.`,
      ``,
      `Requirements:`,
      `- Produce EXACTLY ${totalQuestions} questions TOTAL.`,
      `- Difficulty: ${difficulty}. Hard means subtle traps / near-miss distractors, but still answerable from the file.`,
      `- Output MUST be valid JSON ONLY (no markdown, no extra text).`,
      `- ${tfRule}`,
      ``,
      `For MCQ questions:`,
      `- Each MCQ must have EXACTLY 4 options (strings). Exactly ONE option is correct.`,
      `- Provide feedback (rationale) for why each option is incorrect AND include feedback.correct explaining why the correct option is correct.`,
      `- feedback.correct must be a specific, content-based rationale (>=10 characters).`,
      `- All feedback strings must be NON-EMPTY (no placeholders like "N/A", "none", "", or "--").`,
      ``,
      `JSON schema (follow exactly):`,
      `{`,
      `  "questions": [`,
      `    {`,
      `      "question": "string (non-empty)",`,
      `      "type": "mcq",`,
      `      "options": ["A","B","C","D"],`,
      `      "correct_index": 0,`,
      `      "feedback": {`,
      `        "0": "non-empty",`,
      `        "1": "non-empty",`,
      `        "2": "non-empty",`,
      `        "3": "non-empty",`,
      `        "correct": "non-empty"`,
      `      }`,
      `    },`,
      `    {`,
      `      "question": "string (non-empty)",`,
      `      "type": "true_false",`,
      `      "options": ["True","False"],`,
      `      "correct_index": 0,`,
      `      "feedback": {`,
      `        "0": "non-empty",`,
      `        "1": "non-empty",`,
      `        "correct": "non-empty"`,
      `      }`,
      `    }`,
      `  ]`,
      `}`,
      ``,
      `Hard validation rules (must pass):`,
      `- Every question MUST include feedback.correct as a non-empty string.`,
      `- feedback.correct must be >= 10 characters and cannot be filler ("N/A", "none", "no feedback").`,
      `- If type="mcq": options length MUST be 4 and feedback MUST include keys "0","1","2","3","correct" (all non-empty).`,
      `- If type="true_false": options MUST be exactly ["True","False"] and feedback MUST include keys "0","1","correct" (all non-empty).`,
      `- Use correct "type" values: "mcq" or "true_false".`,
      ``,
      `Important constraints:`,
      `- Do not include anything outside the schema.`,
      `- Do not include trailing commas.`,
      `- Do not include markdown fences.`,
    ].join('\n');

    promptBox.value = prompt;
    showToast('Prompt built.');
    return prompt;
  }

  buildPromptBtn.addEventListener('click', () => {
    totalQuestionsEl.value = clampInt(totalQuestionsEl.value, 1, 500);
    totalQuestionsValueEl.textContent = totalQuestionsEl.value;
    buildPrompt();
  });

  copyPromptBtn.addEventListener('click', async () => {
    const text = promptBox.value?.trim();
    if (!text) {
      showToast('Nothing to copy.');
      return;
    }
    await navigator.clipboard.writeText(text);
    showToast('Prompt copied.');
  });

  pasteJsonBtn.addEventListener('click', async () => {
    if (!navigator.clipboard?.readText) {
      showToast('Clipboard paste is not supported here.');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showToast('Clipboard is empty.');
        return;
      }
      aiResponse.value = text;
      showToast('Pasted JSON from clipboard.');
    } catch {
      showToast('Unable to paste from clipboard.');
    }
  });

  // ---------- JSON validation ----------
  function validateQuizJson(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Root must be a JSON object.');
      return errors;
    }
    if (!Array.isArray(data.questions)) {
      errors.push('Root must contain "questions" as an array.');
      return errors;
    }
    if (data.questions.length === 0) errors.push('No questions found.');

    data.questions.forEach((q, qi) => {
      if (!q || typeof q !== 'object') {
        errors.push(`questions[${qi}] must be an object.`);
        return;
      }

      if (typeof q.question !== 'string' || !q.question.trim()) {
        errors.push(`questions[${qi}].question must be a non-empty string.`);
      }

      const type = q.type || 'mcq';
      if (type !== 'mcq' && type !== 'true_false') {
        errors.push(`questions[${qi}].type must be "mcq" or "true_false".`);
        return;
      }

      // options: non-empty strings
      if (!Array.isArray(q.options) || q.options.some((x) => typeof x !== 'string' || !x.trim())) {
        errors.push(`questions[${qi}].options must be an array of non-empty strings.`);
        return;
      }

      // options length by type
      if (type === 'mcq') {
        if (q.options.length !== 4) {
          errors.push(`questions[${qi}].options must be an array of 4 strings.`);
        }
      } else {
        if (q.options.length !== 2 || q.options[0] !== 'True' || q.options[1] !== 'False') {
          errors.push(`questions[${qi}].options must be exactly ["True","False"] for true_false.`);
        }
      }

      // correct_index range by type
      const maxIndex = type === 'mcq' ? 3 : 1;
      if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > maxIndex) {
        errors.push(`questions[${qi}].correct_index must be an integer in [0..${maxIndex}].`);
      }

      // feedback validation
      if (!q.feedback || typeof q.feedback !== 'object') {
        errors.push(`questions[${qi}].feedback must be an object.`);
        return;
      }

      if (typeof q.feedback.correct !== 'string' || !q.feedback.correct.trim()) {
        errors.push(`questions[${qi}].feedback.correct must be a non-empty string.`);
      }

      const neededKeys = type === 'mcq' ? ['0', '1', '2', '3'] : ['0', '1'];
      for (const k of neededKeys) {
        if (typeof q.feedback[k] !== 'string' || !q.feedback[k].trim()) {
          errors.push(`questions[${qi}].feedback["${k}"] must be a non-empty string.`);
        }
      }
    });

    return errors;
  }

  // ---------- Render quiz ----------
  renderBtn.addEventListener('click', () => {
    const raw = aiResponse.value?.trim();
    if (!raw) {
      showToast('Paste the AI JSON response first.');
      return;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      showToast('Invalid JSON. Make sure it is JSON ONLY.');
      return;
    }

    const errors = validateQuizJson(data);
    if (errors.length) {
      resultsEl.innerHTML = `
        <div class="card">
          <h3>Validation errors</h3>
          <div class="feedback">${escapeHtml(errors.join('\n'))}</div>
        </div>
      `;
      showToast('AI response failed validation.');
      return;
    }

    resultsEl.innerHTML = '';
    renderQuestions(data.questions);
    showToast('Quiz rendered.');
  });

  function renderQuestions(questions) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = 'Quiz';
    card.appendChild(title);

    questions.forEach((q, qi) => {
      const qWrap = document.createElement('div');
      qWrap.style.marginTop = '12px';

      const qText = document.createElement('div');
      qText.style.fontWeight = '700';
      qText.style.marginBottom = '10px';

      const typeLabel = (q.type === 'true_false') ? ' (T/F)' : '';
      qText.textContent = `${qi + 1}) ${q.question}${typeLabel}`;
      qWrap.appendChild(qText);

      const name = `q-${qi}`;
      const optionEls = [];

      q.options.forEach((opt, oi) => {
        const label = document.createElement('label');
        label.className = 'option';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = String(oi);

        const span = document.createElement('span');
        span.textContent = opt;

        label.appendChild(input);
        label.appendChild(span);

        optionEls.push({ label, input, oi });
        qWrap.appendChild(label);
      });

      const feedback = document.createElement('div');
      feedback.className = 'feedback';
      feedback.textContent = 'Select an answer to see feedback.';
      qWrap.appendChild(feedback);

      optionEls.forEach(({ input }) => {
        input.addEventListener('change', () => {
          gradeOneQuestion(q, optionEls, feedback);
        });
      });

      card.appendChild(qWrap);
    });

    resultsEl.appendChild(card);
  }

  function gradeOneQuestion(q, optionEls, feedbackEl) {
    const selected = optionEls.find((x) => x.input.checked);
    const correctIndex = q.correct_index;

    optionEls.forEach(({ label }) => label.classList.remove('correct', 'wrong'));

    if (!selected) {
      feedbackEl.textContent = 'No option selected.';
      return;
    }

    optionEls.forEach(({ label, oi }) => {
      if (oi === correctIndex) label.classList.add('correct');
    });

    if (selected.oi === correctIndex) {
      feedbackEl.textContent = q.feedback?.correct || 'Correct.';
      return;
    }

    selected.label.classList.add('wrong');

    const wrongReason = q.feedback?.[String(selected.oi)] || 'Incorrect.';
    const correctReason = q.feedback?.correct
      ? `\n\nWhy the correct answer is correct:\n${q.feedback.correct}`
      : '';

    feedbackEl.textContent = `${wrongReason}${correctReason}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
});
