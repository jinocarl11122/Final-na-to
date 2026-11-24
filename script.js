const API = "";

let schedules = {
  jhs: [
    {time:"07:00",name:"Flag Ceremony",bell:1},
    {time:"07:10",name:"Subject 1",bell:2},
    {time:"08:00",name:"Subject 2",bell:1},
    {time:"08:50",name:"Subject 3",bell:3},
    {time:"09:40",name:"Subject 4",bell:1},
    {time:"10:30",name:"Subject 5",bell:2},
    {time:"11:20",name:"Subject 6",bell:3},
    {time:"12:10",name:"Subject 7",bell:1},
    {time:"13:00",name:"Subject 8",bell:2},
    {time:"13:50",name:"Subject 9",bell:3},
    {time:"14:40",name:"Subject 10",bell:1}
  ],
  shs: [
    {time:"07:30",name:"Assembly",bell:1},
    {time:"07:40",name:"Subject 1",bell:2},
    {time:"08:30",name:"Subject 2",bell:1},
    {time:"09:20",name:"Subject 3",bell:3},
    {time:"10:10",name:"Subject 4",bell:1},
    {time:"11:00",name:"Subject 5",bell:2},
    {time:"11:50",name:"Subject 6",bell:3},
    {time:"12:40",name:"Subject 7",bell:1},
    {time:"13:30",name:"Subject 8",bell:2},
    {time:"14:20",name:"Subject 9",bell:3},
    {time:"15:10",name:"Subject 10",bell:1}
  ]
};

let connected = false;
let automatic = false;
let currentLevel = "jhs";
let lastSync = 0;

const $ = id => document.getElementById(id);

async function request(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  return response.json();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  })[c]);
}

// CLOCK

function updateClock() {
  const now = new Date();

  $("clock").textContent = now.toLocaleTimeString();
  $("date").textContent = now.toLocaleDateString();
}

setInterval(updateClock, 1000);
updateClock();

// TIME SYNCHRONIZATION

async function syncTime() {
  try {
    await request("/api/time", {
      method: "POST",
      body: JSON.stringify({
        epoch: Math.floor(Date.now() / 1000)
      })
    });

    $("timeStatus").textContent = "Time synchronized with phone";
    lastSync = Date.now();

  } catch (e) {
    $("timeStatus").textContent = "Waiting for ESP32";
  }
}

// SCHEDULE

function renderSchedule() {
  let html = `
  <table>
    <tr>
      <th>Time</th>
      <th>Event</th>
      <th>Bell</th>
      <th>Action</th>
    </tr>`;

  schedules[currentLevel].forEach((item, i) => {
    html += `
    <tr>
      <td>
        <input type="time" value="${escapeHTML(item.time)}"
        onchange="editRow(${i},'time',this.value)">
      </td>
      <td>
        <input type="text" value="${escapeHTML(item.name)}"
        onchange="editRow(${i},'name',this.value)">
      </td>
      <td>
        <select onchange="editRow(${i},'bell',this.value)">
          <option value="1" ${item.bell == 1 ? "selected" : ""}>Bell 1</option>
          <option value="2" ${item.bell == 2 ? "selected" : ""}>Bell 2</option>
          <option value="3" ${item.bell == 3 ? "selected" : ""}>Bell 3</option>
        </select>
      </td>
      <td>
        <button class="danger" onclick="deleteRow(${i})">
          Delete
        </button>
      </td>
    </tr>`;
  });

  html += "</table>";
  $("schedule").innerHTML = html;
}

function changeLevel() {
  currentLevel = $("level").value;
  renderSchedule();

  request("/api/level", {
    method: "POST",
    body: JSON.stringify({level:currentLevel})
  }).catch(() => {});
}

function editRow(i, key, value) {
  if (key === "bell") value = Number(value);
  schedules[currentLevel][i][key] = value;
  saveSchedule();
}

function addSchedule() {
  schedules[currentLevel].push({
    time:"08:00",
    name:"New Subject",
    bell:1
  });

  renderSchedule();
  saveSchedule();
}

function deleteRow(i) {
  schedules[currentLevel].splice(i, 1);
  renderSchedule();
  saveSchedule();
}

async function saveSchedule() {
  try {
    await request("/api/schedule", {
      method:"POST",
      body:JSON.stringify(schedules)
    });

    $("saveStatus").textContent = "Schedule saved to ESP32.";

  } catch(e) {
    $("saveStatus").textContent = "Cannot save: ESP32 disconnected.";
  }
}

async function loadSchedule() {
  try {
    const data = await request("/api/schedule");

    if (data.jhs && data.shs) {
      schedules = data;
    }

  } catch(e) {
    $("saveStatus").textContent = "Using default schedule.";
  }

  renderSchedule();
}

// BELL CONTROL

async function playBell(number) {
  try {
    await request("/api/bell/" + number, {
      method:"POST"
    });

    $("bellStatus").textContent =
      "Bell " + number + " activated";

  } catch(e) {
    $("bellStatus").textContent = "ESP32 disconnected";
  }
}

async function stopBell() {
  try {
    await request("/api/stop", {
      method:"POST"
    });

    $("bellStatus").textContent = "Bell OFF";

  } catch(e) {
    $("bellStatus").textContent = "ESP32 disconnected";
  }
}

// EMERGENCY

async function testAlarm(type) {
  try {
    await request("/api/test/" + type, {
      method:"POST"
    });

    $("emergencyStatus").textContent =
      "TEST ALARM: " + type;

  } catch(e) {
    $("emergencyStatus").textContent =
      "ESP32 disconnected";
  }
}

async function stopAlarm() {
  try {
    await request("/api/alarm/stop", {
      method:"POST"
    });

    $("emergencyStatus").textContent =
      "Alarm silenced. Check sensor status.";

  } catch(e) {
    $("emergencyStatus").textContent =
      "ESP32 disconnected";
  }
}

// AUTOMATIC MODE

$("automatic").addEventListener("change", async function() {
  automatic = this.checked;

  try {
    await request("/api/automatic", {
      method:"POST",
      body:JSON.stringify({enabled:automatic})
    });
  } catch(e) {
    $("saveStatus").textContent = "ESP32 disconnected.";
  }
});

$("level").addEventListener("change", changeLevel);

// STATUS

async function updateStatus() {
  try {
    const data = await request("/api/status");

    connected = true;

    $("connection").textContent = "CONNECTED";
    $("connection").className = "online";

    $("ip").textContent = "Device IP: " + data.ip;

    $("flame").textContent =
      data.flame ? "ALERT" : "Normal";

    $("smoke").textContent =
      data.smoke ? "ALERT" : "Normal";

    $("vibration").textContent =
      data.vibration ? "DETECTED" : "Normal";

    $("emergencyStatus").textContent =
      data.alarm || "No active alert";

    $("bellStatus").textContent =
      data.bell || "Bell OFF";

    if (typeof data.automatic === "boolean") {
      automatic = data.automatic;
      $("automatic").checked = automatic;
    }

    if (data.level && data.level !== currentLevel) {
      currentLevel = data.level;
      $("level").value = currentLevel;
      renderSchedule();
    }

  } catch(e) {
    connected = false;

    $("connection").textContent = "DISCONNECTED";
    $("connection").className = "offline";
    $("ip").textContent = "Check ESP32 connection";
  }
}

// INITIALIZATION

async function initialize() {
  await loadSchedule();
  await syncTime();
  await updateStatus();

  currentLevel = $("level").value;

  setInterval(updateStatus, 2000);
  setInterval(syncTime, 30000);
}

initialize();
