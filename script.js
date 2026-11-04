
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const mainMenu = document.getElementById("mainMenu");
const friendsMenu = document.getElementById("friendsMenu");
const gameArea = document.getElementById("gameArea");
const gameContainer = document.getElementById("gameContainer");
const roomCodeInput = document.getElementById("roomCode");
const roomMessage = document.getElementById("roomMessage");
const gameMessage = document.getElementById("gameMessage");

let scene, camera, renderer, ball;
let bluePlayers = [], redPlayers = [];
let blueKeeper, redKeeper;
let ballVelocity = new THREE.Vector3();
let ballOwner = null;
let ownerTeam = null;
let controlledPlayer = 1;
let keys = {};

let blueScore = 0;
let redScore = 0;
let gameRunning = false;
let lastTime = 0;

let passLine, passTargetMarker;
let redPassCooldown = 0;
let bluePassCooldown = 0;
let redShootCooldown = 0;

// MENU
document.getElementById("onlineBtn").onclick = () => startGame();

document.getElementById("friendsBtn").onclick = () => {
    mainMenu.classList.add("hidden");
    friendsMenu.classList.remove("hidden");
};

document.getElementById("createRoomBtn").onclick = () => {
    const code = "FC" + Math.floor(1000 + Math.random() * 9000);
    roomCodeInput.value = code;
    roomMessage.textContent = "Demo Room Code: " + code;
};

document.getElementById("joinRoomBtn").onclick = () => {
    const code = roomCodeInput.value.trim();
    roomMessage.textContent = code.length < 4
        ? "Enter a valid Room Code!"
        : "Demo only. Multiplayer server not connected.";
};

document.getElementById("backBtn").onclick = () => {
    friendsMenu.classList.add("hidden");
    mainMenu.classList.remove("hidden");
};

document.getElementById("settingsBtn").onclick = () => {
    alert("Settings coming soon!");
};

document.getElementById("exitBtn").onclick = () => {
    gameRunning = false;

    if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
    }

    gameArea.classList.add("hidden");
    mainMenu.classList.remove("hidden");
};

// PLAYER
function createPlayer(color, x, z) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.48, 1.2, 16),
        new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = 0.9;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xffc99b })
    );
    head.position.y = 1.7;
    group.add(head);

    const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.18, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    legs.position.y = 0.25;
    group.add(legs);

    group.position.set(x, 0, z);
    scene.add(group);
    return group;
}

// FIELD
function createField() {
    const grass = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 24),
        new THREE.MeshStandardMaterial({ color: 0x16813d })
    );
    grass.rotation.x = -Math.PI / 2;
    scene.add(grass);

    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

    function line(x, z, width, depth) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, 0.025, depth),
            white
        );
        mesh.position.set(x, 0.025, z);
        scene.add(mesh);
    }

    line(0, -12, 40, 0.08);
    line(0, 12, 40, 0.08);
    line(-20, 0, 0.08, 24);
    line(20, 0, 0.08, 24);
    line(0, 0, 0.06, 24);

    const circle = new THREE.Mesh(
        new THREE.RingGeometry(2.8, 2.9, 64),
        white
    );
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.035;
    scene.add(circle);

    createGoal(-20);
    createGoal(20);
}

function createGoal(x) {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });

    function post(px, py, pz, w, h, d) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            material
        );
        mesh.position.set(px, py, pz);
        scene.add(mesh);
    }

    post(x, 1.5, -3.5, 0.18, 3, 0.18);
    post(x, 1.5, 3.5, 0.18, 3, 0.18);
    post(x, 3, 0, 0.18, 0.18, 7);
}

// BALL
function createBall() {
    ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    ball.position.set(-4, 0.45, 0);
    scene.add(ball);
}

// PASS INDICATOR
function createPassIndicator() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(6), 3)
    );

    passLine = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x00eaff })
    );
    scene.add(passLine);

    passTargetMarker = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.7, 32),
        new THREE.MeshBasicMaterial({
            color: 0x00eaff,
            side: THREE.DoubleSide
        })
    );

    passTargetMarker.rotation.x = -Math.PI / 2;
    passTargetMarker.position.y = 0.08;
    scene.add(passTargetMarker);
}

// START GAME
function startGame() {
    mainMenu.classList.add("hidden");
    friendsMenu.classList.add("hidden");
    gameArea.classList.remove("hidden");

    blueScore = 0;
    redScore = 0;
    controlledPlayer = 1;
    ballOwner = 1;
    ownerTeam = "blue";
    keys = {};

    redPassCooldown = 0;
    bluePassCooldown = 0;
    redShootCooldown = 0;

    document.getElementById("scoreboard").textContent = "BLUE 0 - 0 RED";
    gameMessage.textContent = "MATCH START!";

    if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
    }

    gameContainer.innerHTML = "";

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x172b3c);

    camera = new THREE.PerspectiveCamera(
        55,
        gameContainer.clientWidth / gameContainer.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 25, 29);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
    gameContainer.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x345522, 2));

    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(0, 20, 10);
    scene.add(light);

    createField();
    createBall();
    createPassIndicator();

    bluePlayers = [
        createPlayer(0x087dff, -5, -5),
        createPlayer(0x087dff, -5, 0),
        createPlayer(0x087dff, -5, 5)
    ];

    redPlayers = [
        createPlayer(0xff3030, 5, -5),
        createPlayer(0xff3030, 5, 0),
        createPlayer(0xff3030, 5, 5)
    ];

    blueKeeper = createPlayer(0x087dff, -18, 0);
    redKeeper = createPlayer(0xff3030, 18, 0);

    attachBallToOwner();

    gameRunning = true;
    lastTime = 0;
    requestAnimationFrame(animate);
}

// KEYBOARD
window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
    }

    keys[key] = true;

    if (event.repeat || !gameRunning) return;

    if (["1", "2", "3"].includes(key)) {
        controlledPlayer = Number(key) - 1;
        gameMessage.textContent = "BLUE PLAYER " + (controlledPlayer + 1);
    }

    if (key === "f") passBall("blue");
    if (key === " ") shootBall("blue");
});

window.addEventListener("keyup", event => {
    keys[event.key.toLowerCase()] = false;
});

// MOVEMENT
function movePlayer(player, target, dt, speed) {
    const dx = target.x - player.position.x;
    const dz = target.z - player.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance > 0.18) {
        const step = Math.min(speed * dt, distance);
        player.position.x += dx / distance * step;
        player.position.z += dz / distance * step;
    }

    player.position.x = THREE.MathUtils.clamp(player.position.x, -19, 19);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -11, 11);
}

function moveHuman(dt) {
    const player = bluePlayers[controlledPlayer];
    const speed = 8;

    let dx = 0;
    let dz = 0;

    if (keys["w"] || keys["arrowup"]) dz -= 1;
    if (keys["s"] || keys["arrowdown"]) dz += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;

    const length = Math.hypot(dx, dz);

    if (length > 0) {
        player.position.x += dx / length * speed * dt;
        player.position.z += dz / length * speed * dt;
    }

    player.position.x = THREE.MathUtils.clamp(player.position.x, -19, 19);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -11, 11);
}

// BALL OWNER
function attachBallToOwner() {
    if (ballOwner === null) return;

    const team = ownerTeam === "blue" ? bluePlayers : redPlayers;
    const player = team[ballOwner];

    ball.position.set(
        player.position.x + (ownerTeam === "blue" ? 0.85 : -0.85),
        0.45,
        player.position.z
    );

    ballVelocity.set(0, 0, 0);
}

// BLUE SUPPORT AI
function updateBlueAI(dt) {
    bluePlayers.forEach((player, index) => {
        if (index === controlledPlayer) return;
        if (ownerTeam === "blue" && ballOwner === index) return;

        const target = new THREE.Vector3(
            THREE.MathUtils.clamp(ball.position.x + 4, -16, 16),
            0,
            THREE.MathUtils.clamp(
                ball.position.z + (index === 0 ? -5 : index === 1 ? 0 : 5),
                -9,
                9
            )
        );

        movePlayer(player, target, dt, 4.5);
    });
}

// RED TEAM AI
function updateRedAI(dt) {
    redPlayers.forEach((player, index) => {
        if (ownerTeam === "red" && ballOwner === index) return;

        let target;

        if (ownerTeam === "blue") {
            // Chase and challenge the Blue ball carrier
            const carrier = bluePlayers[ballOwner];

            if (index === 1) {
                target = new THREE.Vector3(
                    carrier.position.x + 0.7,
                    0,
                    carrier.position.z
                );
            } else {
                target = new THREE.Vector3(
                    carrier.position.x + 3,
                    0,
                    carrier.position.z + (index === 0 ? -4 : 4)
                );
            }
        } else if (ownerTeam === "red") {
            // Red players move into attacking positions
            target = new THREE.Vector3(
                ball.position.x - 4,
                0,
                ball.position.z + (index === 0 ? -5 : index === 1 ? 0 : 5)
            );
        } else {
            target = new THREE.Vector3(
                ball.position.x + 1,
                0,
                ball.position.z
            );
        }

        target.x = THREE.MathUtils.clamp(target.x, -16, 16);
        target.z = THREE.MathUtils.clamp(target.z, -9, 9);

        movePlayer(player, target, dt, 4.2);
    });
}

// TAKE POSSESSION
function updateTakePossession() {
    if (ownerTeam !== null) return;

    bluePlayers.forEach((player, index) => {
        if (ownerTeam !== null) return;

        if (player.position.distanceTo(ball.position) < 0.85) {
            ownerTeam = "blue";
            ballOwner = index;
            controlledPlayer = index;
            gameMessage.textContent = "BLUE TEAM HAS THE BALL!";
            attachBallToOwner();
        }
    });

    redPlayers.forEach((player, index) => {
        if (ownerTeam !== null) return;

        if (player.position.distanceTo(ball.position) < 0.85) {
            ownerTeam = "red";
            ballOwner = index;
            gameMessage.textContent = "RED TEAM HAS THE BALL!";
            attachBallToOwner();
        }
    });
}

// STEAL BALL
function updateStealing() {
    if (ballOwner === null) return;

    const defendingTeam = ownerTeam === "blue" ? redPlayers : bluePlayers;
    const attackingTeam = ownerTeam === "blue" ? bluePlayers : redPlayers;

    const carrier = attackingTeam[ballOwner];

    defendingTeam.forEach((player, index) => {
        if (ownerTeam === null) return;

        if (player.position.distanceTo(carrier.position) < 1.05) {
            ownerTeam = ownerTeam === "blue" ? "red" : "blue";
            ballOwner = index;

            if (ownerTeam === "blue") {
                controlledPlayer = index;
                gameMessage.textContent = "BLUE TEAM WON THE BALL!";
            } else {
                gameMessage.textContent = "RED TEAM STOLE THE BALL!";
            }

            attachBallToOwner();
        }
    });
}

// PASS TARGET
function getPassTarget(team) {
    const players = team === "blue" ? bluePlayers : redPlayers;
    const owner = players[ballOwner];

    let best = null;
    let bestScore = Infinity;

    players.forEach((player, index) => {
        if (index === ballOwner) return;

        const distance = owner.position.distanceTo(player.position);

        const forwardBonus = team === "blue"
            ? (player.position.x > owner.position.x ? 3 : 0)
            : (player.position.x < owner.position.x ? 3 : 0);

        const score = distance - forwardBonus;

        if (score < bestScore) {
            bestScore = score;
            best = player;
        }
    });

    return best;
}

// PASS LINE
function updatePassLine() {
    if (ownerTeam !== "blue" || ballOwner === null) {
        passLine.visible = false;
        passTargetMarker.visible = false;
        return;
    }

    if (ballOwner !== controlledPlayer) {
        passLine.visible = false;
        passTargetMarker.visible = false;
        return;
    }

    const target = getPassTarget("blue");
    if (!target) return;

    const positions = passLine.geometry.attributes.position;

    positions.setXYZ(0, ball.position.x, 0.65, ball.position.z);
    positions.setXYZ(1, target.position.x, 0.65, target.position.z);
    positions.needsUpdate = true;

    passLine.visible = true;
    passTargetMarker.visible = true;

    passTargetMarker.position.set(target.position.x, 0.08, target.position.z);
}

// PASS
function passBall(team) {
    if (!gameRunning || ownerTeam !== team || ballOwner === null) return;

    if (team === "blue" && ballOwner !== controlledPlayer) return;

    const target = getPassTarget(team);
    if (!target) return;

    const direction = new THREE.Vector3(
        target.position.x - ball.position.x,
        0,
        target.position.z - ball.position.z
    ).normalize();

    ownerTeam = null;
    ballOwner = null;

    ballVelocity.copy(direction.multiplyScalar(13));

    if (team === "blue") {
        gameMessage.textContent = "BLUE TEAM PASS!";
        bluePassCooldown = 0.6;
    } else {
        gameMessage.textContent = "RED TEAM PASS!";
        redPassCooldown = 1.2;
    }
}

// SHOOT
function shootBall(team) {
    if (!gameRunning || ownerTeam !== team || ballOwner === null) return;

    if (team === "blue" && ballOwner !== controlledPlayer) return;

    ownerTeam = null;
    ballOwner = null;

    const direction = team === "blue"
        ? new THREE.Vector3(1, 0, -ball.position.z * 0.1)
        : new THREE.Vector3(-1, 0, -ball.position.z * 0.1);

    direction.normalize();

    ballVelocity.copy(direction.multiplyScalar(team === "blue" ? 18 : 16));

    gameMessage.textContent = team === "blue" ? "BLUE SHOOT!" : "RED SHOOT!";
}

// RED ATTACK AI
function updateRedAttack(dt) {
    if (ownerTeam !== "red" || ballOwner === null) return;

    redShootCooldown -= dt;
    redPassCooldown -= dt;

    const carrier = redPlayers[ballOwner];
    const distanceToGoal = 20 - carrier.position.x;

    // Shoot when close to Blue goal
    if (distanceToGoal < 11 && redShootCooldown <= 0) {
        shootBall("red");
        redShootCooldown = 2.5;
        return;
    }

    // Pass when teammate is in a better position
    if (redPassCooldown <= 0 && carrier.position.x < 8) {
        const target = getPassTarget("red");

        if (target) {
            const teammateAhead = target.position.x < carrier.position.x;

            if (teammateAhead) {
                passBall("red");
                redPassCooldown = 2;
            }
        }
    }
}

// BLUE GOALKEEPER
function updateBlueKeeper(dt) {
    const target = new THREE.Vector3(
        -18,
        0,
        THREE.MathUtils.clamp(ball.position.z, -3, 3)
    );

    movePlayer(blueKeeper, target, dt, 3.5);
}

// RED GOALKEEPER
function updateRedKeeper(dt) {
    const target = new THREE.Vector3(
        18,
        0,
        THREE.MathUtils.clamp(ball.position.z, -3, 3)
    );

    movePlayer(redKeeper, target, dt, 3.5);
}

// BALL PHYSICS
function updateBall(dt) {
    if (ballOwner !== null) {
        attachBallToOwner();
        return;
    }

    ball.position.x += ballVelocity.x * dt;
    ball.position.z += ballVelocity.z * dt;

    ballVelocity.multiplyScalar(Math.pow(0.985, dt * 60));

    if (Math.abs(ball.position.z) > 11.5) {
        ball.position.z = THREE.MathUtils.clamp(ball.position.z, -11.5, 11.5);
        ballVelocity.z *= -0.7;
    }

    // GOALS
    if (ball.position.x > 20 && Math.abs(ball.position.z) < 3.5) {
        blueScore++;
        resetBall("red");
        return;
    }

    if (ball.position.x < -20 && Math.abs(ball.position.z) < 3.5) {
        redScore++;
        resetBall("blue");
        return;
    }

    if (Math.abs(ball.position.x) > 20) {
        ball.position.x = Math.sign(ball.position.x) * 20;
        ballVelocity.x *= -0.6;
    }

    // Goalkeeper blocks
    if (
        ball.position.x < -16.5 &&
        Math.abs(ball.position.z - blueKeeper.position.z) < 1.5
    ) {
        ballVelocity.x = Math.abs(ballVelocity.x) * 0.8;
    }

    if (
        ball.position.x > 16.5 &&
        Math.abs(ball.position.z - redKeeper.position.z) < 1.5
    ) {
        ballVelocity.x = -Math.abs(ballVelocity.x) * 0.8;
    }

    ball.position.y = 0.45;
}

// RESET
function resetBall(kickoffTeam) {
    ballVelocity.set(0, 0, 0);

    bluePlayers[0].position.set(-5, 0, -5);
    bluePlayers[1].position.set(-5, 0, 0);
    bluePlayers[2].position.set(-5, 0, 5);

    redPlayers[0].position.set(5, 0, -5);
    redPlayers[1].position.set(5, 0, 0);
    redPlayers[2].position.set(5, 0, 5);

    controlledPlayer = 1;

    if (kickoffTeam === "blue") {
        ownerTeam = "blue";
        ballOwner = 1;
        ball.position.set(-4.15, 0.45, 0);
    } else {
        ownerTeam = "red";
        ballOwner = 1;
        ball.position.set(4.15, 0.45, 0);
    }

    gameMessage.textContent = "GOAL! KICK-OFF!";

    document.getElementById("scoreboard").textContent =
        `BLUE ${blueScore} - ${redScore} RED`;
}

// ANIMATION
function animate(time) {
    if (!gameRunning) return;

    requestAnimationFrame(animate);

    const dt = Math.min((time - lastTime) / 1000 || 0, 0.04);
    lastTime = time;

    moveHuman(dt);

    updateBlueAI(dt);
    updateRedAI(dt);

    updateStealing();

    if (ownerTeam === "red") {
        updateRedAttack(dt);
    }

    updateBall(dt);
    updateTakePossession();

    updateBlueKeeper(dt);
    updateRedKeeper(dt);

    updatePassLine();

    ball.rotation.x += ballVelocity.z * dt;
    ball.rotation.z += ballVelocity.x * dt;

    document.getElementById("scoreboard").textContent =
        `BLUE ${blueScore} - ${redScore} RED`;

    renderer.render(scene, camera);
}

// RESIZE
window.addEventListener("resize", () => {
    if (!renderer || !gameContainer.clientWidth) return;

    camera.aspect = gameContainer.clientWidth / gameContainer.clientHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(
        gameContainer.clientWidth,
        gameContainer.clientHeight
    );
});
