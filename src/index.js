import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import "@fontsource/press-start-2p";

require("./main.css");

// Constants 這裡定義了遊戲中使用的各種常數.
const TREX_JUMP_SPEED = 20;

const CACTUS_SPAWN_X = 20;
const CACTUS_DESTROY_X = -20;
const CACTUS_MAX_SCALE = 1.3;
const CACTUS_MIN_SCALE = 0.8;
const CACTUS_SPAWN_MAX_INTERVAL = 3;
const CACTUS_SPAWN_MIN_INTERVAL = 1;

const PTERODACTYL_MIN_Y = 4;
const PTERODACTYL_MAX_Y = 5;
const PTERODACTYL_SPAWN_X = -5;
const PTERODACTYL_SPAWN_INTERVAL = 20;
const PTERODACTYL_SPEED = 2;

const GRAVITY = -50;
const FLOOR_SPEED = -10;
const SKYSPHERE_ROTATE_SPEED = 0.02;
const SCORE_INCREASE_SPEED = 5;
let currentDinosaurIndex = 0; // 當前恐龍模型的索引
const dinosaurModels = ["t-rex", "t-rex2"]; // 可用的恐龍模型列表

// Global variables.
const scene = new THREE.Scene();
let infoElement;
const clock = new THREE.Clock();
const mixers = [];
let trex;
let cactus;
let floor;
let pterodactyl;
let skySphere;
let directionalLight;
let jump = false;
let vel = 0;
let nextCactusSpawnTime = 0;
let nextPterodactylResetTime = 0;
let score = 0;
let isGameOver = true;
const cactusGroup = new THREE.Group();
scene.add(cactusGroup);
let renderer;
let camera;
// 創建資訊元素函數： 這個函數創建了一個資訊元素（HTML div），用於顯示遊戲的提示信息.
function createInfoElement() {
  infoElement = document.createElement("div");
  infoElement.id = "info";
  infoElement.innerHTML = "Press any key to start!";
  document.body.appendChild(infoElement);
}
createInfoElement();
// 創建攝影機函數： 這個函數創建了遊戲的攝影機，設置了攝影機的位置和方向.
function createCamera() {
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 1, 10);
  camera.lookAt(3, 3, 0);
}
createCamera();
// 創建渲染器函數： 這個函數創建了 Three.js 的渲染器，設置了渲染器的參數，然後將渲染器的 DOM 元素添加到 HTML 頁面中.
function createRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x7f7f7f);
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 3.5; // 調整為更高的值
  document.body.appendChild(renderer.domElement);
}
createRenderer();
// 動畫函數： 這個函數使用 requestAnimationFrame 遞迴地執行，每次呼叫時更新遊戲的狀態，然後呼叫渲染器來繪製場景.
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  update(delta);

  renderer.render(scene, camera);
}
animate();
// 創建燈光函數： 這個函數創建了遊戲的照明，包括一個定向光和一個環境光.
function createLighting() {
  directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.intensity = 2;
  directionalLight.position.set(0, 10, 0);

  const targetObject = new THREE.Object3D();
  targetObject.position.set(0, 0, 0);
  scene.add(targetObject);
  directionalLight.target = targetObject;

  scene.add(directionalLight);

  const light = new THREE.AmbientLight(0x7f7f7f); // soft white light
  light.intensity = 1;
  scene.add(light);
}
createLighting();
// 加載3D模型函數： 這個函數使用 GLTFLoader 加載遊戲中的3D模型，包括T-Rex、翼龍和仙人掌.
function load3DModels() {
  // Instantiate a loader.
  const loader = new GLTFLoader();

  // Load T-Rex model.
  loader.load(
    "models/human/scene.gltf",
    function (gltf) {
      trex = gltf.scene;

      trex.scale.setScalar(0.005);
      trex.rotation.y = Math.PI / 2;

      scene.add(trex);

      const mixer = new THREE.AnimationMixer(trex);
      const clip = THREE.AnimationClip.findByName(gltf.animations, "GltfAnimation 0");
      if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
      }
      mixers.push(mixer);
    },
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    function (error) {
      console.log("An error happened");
    }
  );

  // Load pterodactyl (flying dinosaur) model.
  loader.load("models/pterodactyl/scene.gltf", function (gltf) {
    pterodactyl = gltf.scene;

    pterodactyl.rotation.y = Math.PI / 2;
    pterodactyl.scale.multiplyScalar(4);

    respawnPterodactyl();

    scene.add(pterodactyl);

    const mixer = new THREE.AnimationMixer(pterodactyl);
    const clip = THREE.AnimationClip.findByName(gltf.animations, "flying");
    const action = mixer.clipAction(clip);
    action.play();
    mixers.push(mixer);
  });

  loader.load(
    "models/cactus/scene.gltf",
    function (gltf) {
      gltf.scene.scale.setScalar(0.05);
      gltf.scene.rotation.y = -Math.PI / 2;

      cactus = gltf.scene;
    },
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    function (error) {
      console.log("An error happened");
    }
  );
}
load3DModels();
// 創建地面函數： 這個函數創建了遊戲的地面，使用一個平面幾何體並應用紋理.
function createFloor() {
  const geometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load("sand.jpg");
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xc4733b,
  });

  floor = new THREE.Mesh(geometry, material);
  floor.material.side = THREE.DoubleSide;
  floor.rotation.x = -Math.PI / 2;

  floor.castShadow = false;
  floor.receiveShadow = true;

  scene.add(floor);
}
createFloor();
// 創建天空球函數： 這個函數創建了一個天空球，它用於環境的背景，並應用了一個圖片紋理.
function createSkySphere(file) {
  const geometry = new THREE.SphereGeometry(50, 60, 40);
  // Invert the geometry on the x-axis so that all of the faces point inward
  geometry.scale(-1, 1, 1);

  const texture = new THREE.TextureLoader().load(file);
  texture.outputEncoding = THREE.sRGBEncoding;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  skySphere = new THREE.Mesh(geometry, material);

  scene.add(skySphere);
}
createSkySphere("desert.jpg");
// 啟用陰影函數： 這個函數設置渲染器和燈光的陰影效果.
function enableShadow(renderer, light) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  light.castShadow = true;

  //Set up shadow properties for the light
  light.shadow.mapSize.width = 512;
  light.shadow.mapSize.height = 512;
  light.shadow.camera.near = 0.001;
  light.shadow.camera.far = 500;
}
enableShadow(renderer, directionalLight);
// 處理輸入函數： 這個函數監聽用戶的輸入，例如按鍵、點擊等，並根據不同情況執行不同的操作.
function handleInput() {
  const callback = () => {
    if (isGameOver) {
      restartGame();
      return;
    }

    jump = true;
  };

  document.addEventListener("keydown", callback, false);
  renderer.domElement.addEventListener("touchstart", callback);
  renderer.domElement.addEventListener("click", callback);
}
handleInput();
// 處理窗口調整大小函數： 這個函數監聽窗口的大小變化，並在窗口大小變化時調整攝影機和渲染器的參數.
function handleWindowResize() {
  window.addEventListener(
    "resize",
    () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    },
    false
  );
}
handleWindowResize();
// 隨機整數函數： 這個函數用於生成指定範圍內的隨機整數.
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}
// 遊戲結束函數： 這個函數在遊戲結束時被呼叫.
function gameOver() {
  isGameOver = true;
  infoElement.innerHTML = "GAME OVER";
  infoElement.style.color = "red"; // 設置文字顏色為紅色
}
// 重新開始遊戲函數： 這個函數在重新開始遊戲時被呼叫，重置遊戲的狀態和數據.
function restartGame() {
  isGameOver = false;
  score = 0;

  respawnPterodactyl();

  cactusGroup.children.length = 0;
  infoElement.style.color = "white";
}
// 重新生成翼龍函數： 這個函數用於在適當的時間點重新生成翼龍，以實現翼龍的循環出現.
function respawnPterodactyl() {
  nextPterodactylResetTime = clock.elapsedTime + PTERODACTYL_SPAWN_INTERVAL;
  pterodactyl.position.x = PTERODACTYL_SPAWN_X;
  pterodactyl.position.y = randomFloat(PTERODACTYL_MIN_Y, PTERODACTYL_MAX_Y);

  pterodactyl.traverse((child) => {
    child.castShadow = true; // 設置為 true 以啟用陰影
    child.receiveShadow = false; // 根據情況調整此處的屬性
  });
}
// 這個函數在每個遊戲循環中被呼叫，用於更新遊戲的狀態，例如移動物體、處理碰撞等.
function update(delta) {
  if (!cactus) return;
  if (!trex) return;
  if (!floor) return;
  if (!pterodactyl) return;
  if (isGameOver) return;

  // 保存恐龍和翼龍模型的陰影屬性
  const trexShadow = trex.children[0].castShadow;
  const pterodactylShadow = pterodactyl.children[0].castShadow;

  for (const mixer of mixers) {
    mixer.update(delta);
  }

  for (const mixer of mixers) {
    mixer.update(delta);
  }

  // T-rex jump.
  if (jump) {
    jump = false;

    // Start jumpping only when T-rex is on the ground.
    if (trex.position.y == 0) {
      vel = TREX_JUMP_SPEED;
      trex.position.y = vel * delta;
    }
  }

  if (trex.position.y > 0) {
    vel += GRAVITY * delta;
    trex.position.y += vel * delta;
  } else {
    trex.position.y = 0;
  }

  // Spawn new cacti.
  if (clock.elapsedTime > nextCactusSpawnTime) {
    const interval = randomFloat(
      CACTUS_SPAWN_MIN_INTERVAL,
      CACTUS_SPAWN_MAX_INTERVAL
    );

    nextCactusSpawnTime = clock.elapsedTime + interval;

    const numCactus = randomInt(1, 4);// 隨機生成仙人掌的數量，範圍為1到5個
    for (let i = 0; i < numCactus; i++) {
      const clone = cactus.clone();
      clone.position.x = CACTUS_SPAWN_X + i;
      clone.scale.multiplyScalar(
        randomFloat(CACTUS_MIN_SCALE, CACTUS_MAX_SCALE)
      );

      cactusGroup.add(clone);
    }
  }

  // Move cacti.
  for (const cactus of cactusGroup.children) {
    cactus.position.x += FLOOR_SPEED * delta;
  }

  // Remove out-of-the-screen cacti.
  while (
    cactusGroup.children.length > 0 &&
    cactusGroup.children[0].position.x < CACTUS_DESTROY_X // out of the screen
  ) {
    cactusGroup.remove(cactusGroup.children[0]);
  }

  // Check collision.
  const trexAABB = new THREE.Box3(
    new THREE.Vector3(-1, trex.position.y, 0),
    new THREE.Vector3(1, trex.position.y + 1, 0)
  );

  for (const cactus of cactusGroup.children) {
    const cactusAABB = new THREE.Box3();
    cactusAABB.setFromObject(cactus);

    if (cactusAABB.intersectsBox(trexAABB)) {
      gameOver();
      return;
    }
  }

  // Update texture offset to simulate floor moving.
  floor.material.map.offset.add(new THREE.Vector2(delta, -delta));

  trex.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = false; // 根據情況調整此處的屬性
  });

  if (skySphere) {
    skySphere.rotation.y += delta * SKYSPHERE_ROTATE_SPEED;
  }

  if (clock.elapsedTime > nextPterodactylResetTime) {
    respawnPterodactyl();
  } else {
    pterodactyl.position.x += delta * PTERODACTYL_SPEED;
    pterodactyl.traverse((child) => {
      child.castShadow = pterodactylShadow;
      child.receiveShadow = false; // 根據情況調整此處的屬性
    });
  }

  score += delta * SCORE_INCREASE_SPEED;
  infoElement.innerHTML = Math.floor(score).toString().padStart(5, "0");
}
