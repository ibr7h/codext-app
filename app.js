const recordToggle = document.getElementById('record-toggle');
const saveEntryButton = document.getElementById('save-entry');
const transcriptField = document.getElementById('transcript');
const statusText = document.getElementById('recording-status');
const timerText = document.getElementById('record-time');
const entriesList = document.getElementById('entries-list');
const clearButton = document.getElementById('clear-all');
const dateFilter = document.getElementById('date-filter');
const homeScreen = document.getElementById('home-screen');
const entriesScreen = document.getElementById('entries-screen');
const homeNavButton = document.getElementById('nav-home');
const entriesNavButton = document.getElementById('nav-entries');

const STORAGE_KEY = 'voice-journal-entries';
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let mediaRecorder;
let stream;
let isRecording = false;
let startTime;
let timerInterval;
let recognition;
let finalTranscript = '';

function readEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function writeEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatDateHeader(isoDate) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTime(isoDate) {
  return new Date(isoDate).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function setActiveScreen(screenName) {
  const showHome = screenName === 'home';

  homeScreen.classList.toggle('active', showHome);
  entriesScreen.classList.toggle('active', !showHome);
  homeNavButton.classList.toggle('active', showHome);
  entriesNavButton.classList.toggle('active', !showHome);
}

function buildEmptyMessage(message) {
  entriesList.innerHTML = `<p class="empty-state">${message}</p>`;
}

function renderEntries() {
  const selectedDate = dateFilter.value;
  let entries = readEntries();

  if (selectedDate) {
    entries = entries.filter((entry) => entry.createdAt.slice(0, 10) === selectedDate);
  }

  if (entries.length === 0) {
    buildEmptyMessage(selectedDate ? 'No entries for this date.' : 'No entries yet.');
    return;
  }

  entriesList.innerHTML = '';
  let currentDate = '';

  entries
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((entry) => {
      const dayKey = new Date(entry.createdAt).toDateString();

      if (dayKey !== currentDate) {
        currentDate = dayKey;
        const heading = document.createElement('h3');
        heading.className = 'entry-date';
        heading.textContent = formatDateHeader(entry.createdAt);
        entriesList.appendChild(heading);
      }

      const item = document.createElement('article');
      item.className = 'entry-item';

      const time = document.createElement('p');
      time.className = 'entry-time';
      time.textContent = formatTime(entry.createdAt);

      const text = document.createElement('p');
      text.className = 'entry-text';
      text.textContent = entry.transcript;

      item.append(time, text);
      entriesList.appendChild(item);
    });
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    timerText.textContent = formatDuration(elapsedSeconds);
  }, 200);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerText.textContent = '00:00';
}

function createRecognition() {
  if (!SpeechRecognition) {
    return null;
  }

  const speech = new SpeechRecognition();
  speech.continuous = true;
  speech.interimResults = true;
  speech.lang = 'en-US';

  speech.onresult = (event) => {
    let interim = '';

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const snippet = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalTranscript += `${snippet.trim()} `;
      } else {
        interim += snippet;
      }
    }

    transcriptField.value = `${finalTranscript}${interim}`.trim();
    saveEntryButton.disabled = transcriptField.value.trim().length === 0;
  };

  speech.onerror = () => {
    statusText.textContent = 'Transcription interrupted. Keep speaking or stop recording.';
  };

  return speech;
}

async function startRecording() {
  finalTranscript = '';
  transcriptField.value = '';
  saveEntryButton.disabled = true;

  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = 'Microphone access is unavailable in this browser.';
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    recognition = createRecognition();
    recognition?.start();

    isRecording = true;
    recordToggle.textContent = 'Stop Recording';
    recordToggle.classList.add('recording');
    statusText.textContent = 'Recording... Speak your journal entry.';
    startTimer();
  } catch {
    statusText.textContent = 'Unable to access microphone. Check permissions and try again.';
  }
}

function stopRecording() {
  if (!isRecording) {
    return;
  }

  isRecording = false;
  mediaRecorder?.stop();
  recognition?.stop();
  stream?.getTracks().forEach((track) => track.stop());

  recordToggle.textContent = 'Start Recording';
  recordToggle.classList.remove('recording');
  statusText.textContent = 'Recording stopped. Review, edit, and save your transcription.';
  stopTimer();

  if (!SpeechRecognition && transcriptField.value.trim().length === 0) {
    transcriptField.placeholder = 'Speech transcription is unavailable. Type your journal note here.';
    statusText.textContent = 'Recording captured. Type your note, then save.';
  }

  saveEntryButton.disabled = transcriptField.value.trim().length === 0;
}

function saveEntry() {
  const text = transcriptField.value.trim();

  if (!text) {
    return;
  }

  const entries = readEntries();
  entries.unshift({
    id: crypto.randomUUID(),
    transcript: text,
    createdAt: new Date().toISOString()
  });

  writeEntries(entries);
  renderEntries();

  transcriptField.value = '';
  finalTranscript = '';
  saveEntryButton.disabled = true;
  statusText.textContent = 'Entry saved. Ready for your next thought.';
}

recordToggle.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

transcriptField.addEventListener('input', () => {
  saveEntryButton.disabled = transcriptField.value.trim().length === 0;
});

saveEntryButton.addEventListener('click', saveEntry);

dateFilter.addEventListener('change', renderEntries);

clearButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  dateFilter.value = '';
  renderEntries();
  statusText.textContent = 'All entries cleared.';
});

homeNavButton.addEventListener('click', () => setActiveScreen('home'));
entriesNavButton.addEventListener('click', () => {
  setActiveScreen('entries');
  renderEntries();
});

renderEntries();
setActiveScreen('home');
