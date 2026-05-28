import { normalizeTitle, resolveServiceImage, SERVICE_PHOTO_MAP } from './serviceImages.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function assertEqual(a, b, label) {
  assert(a === b, `${label} (got: ${JSON.stringify(a)}, expected: ${JSON.stringify(b)})`);
}

console.log('\n-- normalizeTitle --');
assertEqual(normalizeTitle('Брови'), 'брови', 'приведение к нижнему регистру');
assertEqual(normalizeTitle('  Брови  '), 'брови', 'trim пробелов');
assertEqual(normalizeTitle('Брови  хной'), 'брови хной', 'схлопывание двойных пробелов');
assertEqual(normalizeTitle('Коррекция ПМ бровей'), normalizeTitle('КОРРЕКЦИЯ ПМ БРОВЕЙ'), 'регистронезависимость');
assertEqual(normalizeTitle('Лифтинг и ламинирование ресниц'), 'лифтинг и ламинирование ресниц', 'базовая строка');
assertEqual(normalizeTitle('Ёж'), 'еж', 'замена ё→е');
assertEqual(normalizeTitle('Услуга—название'), 'услуга-название', 'длинное тире → дефис');
assertEqual(normalizeTitle('Услуга–название'), 'услуга-название', 'короткое тире → дефис');

console.log('\n-- resolveServiceImage: SERVICE_PHOTO_MAP пуст — любая услуга даёт плейсхолдер --');
const exactMatch = resolveServiceImage({ id: 'any', name: 'Перманентный макияж бровей', cat: 'Брови' });
assertEqual(exactMatch.type, 'placeholder', 'type = placeholder (карта пуста, MVP-состояние)');
assert(exactMatch.emoji !== undefined, 'emoji присутствует');
assert(exactMatch.grad !== undefined, 'grad присутствует');

console.log('\n-- resolveServiceImage: нет точного совпадения, известная категория → плейсхолдер категории --');
const catWithPhoto = resolveServiceImage({ id: 'any', name: 'Неизвестная услуга из категории Брови', cat: 'Брови' });
assertEqual(catWithPhoto.type, 'placeholder', 'type = placeholder (фолбэк на категорию)');

console.log('\n-- resolveServiceImage: неизвестная категория → дефолтный плейсхолдер --');
const unknownCat = resolveServiceImage({ id: 'any', name: 'Неизвестная услуга', cat: 'НеизвестнаяКат' });
assertEqual(unknownCat.type, 'placeholder', 'type = placeholder');
assert(typeof unknownCat.emoji === 'string' && unknownCat.emoji.length > 0, 'emoji есть');
assert(typeof unknownCat.grad === 'string' && unknownCat.grad.length > 0, 'grad есть');

console.log('\n-- resolveServiceImage: пустая категория → дефолтный плейсхолдер --');
const emptyCat = resolveServiceImage({ id: 'any', name: 'Услуга без категории', cat: '' });
assertEqual(emptyCat.type, 'placeholder', 'type = placeholder');
assert(typeof emptyCat.emoji === 'string', 'emoji есть');

console.log('\n-- resolveServiceImage: нормализация при сопоставлении --');
const upperCase = resolveServiceImage({ id: 'any', name: 'ПЕРМАНЕНТНЫЙ МАКИЯЖ БРОВЕЙ', cat: 'Брови' });
assertEqual(upperCase.type, 'placeholder', 'верхний регистр → плейсхолдер (карта пуста)');

const doubleSpace = resolveServiceImage({ id: 'any', name: 'Перманентный  макияж  бровей', cat: 'Брови' });
assertEqual(doubleSpace.type, 'placeholder', 'двойные пробелы → плейсхолдер (карта пуста)');

const yoVariant = resolveServiceImage({ id: 'any', name: 'Оформлениё бровей хной', cat: 'Брови' });
const yoBase = resolveServiceImage({ id: 'any', name: 'Оформление бровей хной', cat: 'Брови' });
assertEqual(yoVariant.type, yoBase.type, 'ё/е: одинаковый тип (оба плейсхолдер)');

console.log('\n-- resolveServiceImage: id не влияет на результат --');
const r1 = resolveServiceImage({ id: 'id-111', name: 'Микроблейдинг бровей', cat: 'Брови' });
const r2 = resolveServiceImage({ id: 'id-999', name: 'Микроблейдинг бровей', cat: 'Брови' });
assertEqual(r1.type, r2.type, 'разные id → одинаковый type');
assert(r1.emoji === r2.emoji, 'разные id → одинаковый emoji');

console.log('\n-- resolveServiceImage: категория Глаза --');
const eyes = resolveServiceImage({ id: 'any', name: 'Неизвестная услуга', cat: 'Глаза' });
assertEqual(eyes.type, 'placeholder', 'Глаза: плейсхолдер категории');

console.log('\n-- resolveServiceImage: категория Эпиляция --');
const epil = resolveServiceImage({ id: 'any', name: 'Неизвестная услуга', cat: 'Эпиляция' });
assertEqual(epil.type, 'placeholder', 'Эпиляция: плейсхолдер категории');

console.log('\n-- resolveServiceImage: исключений не бросает при некорректном входе --');
let noThrow = true;
try {
  resolveServiceImage({ id: '', name: '', cat: undefined });
} catch {
  noThrow = false;
}
assert(noThrow, 'undefined cat не бросает исключение');

try {
  resolveServiceImage({});
} catch {
  noThrow = false;
}
assert(noThrow, 'пустой объект не бросает исключение');

console.log('\n-- resolveServiceImage: type:photo когда запись есть в SERVICE_PHOTO_MAP --');
const TEST_KEY = normalizeTitle('Тест-услуга фото');
SERVICE_PHOTO_MAP[TEST_KEY] = '/photos/test.jpg';
try {
  const photoExact = resolveServiceImage({ id: 'any', name: 'Тест-услуга фото', cat: 'Брови' });
  assertEqual(photoExact.type, 'photo', 'точное совпадение → type = photo');
  assertEqual(photoExact.src, '/photos/test.jpg', 'src совпадает с записью в карте');
  assert(photoExact.emoji !== undefined, 'emoji присутствует при type:photo');
  assert(photoExact.grad !== undefined, 'grad присутствует при type:photo');

  const photoUpper = resolveServiceImage({ id: 'any', name: 'ТЕСТ-УСЛУГА ФОТО', cat: 'Брови' });
  assertEqual(photoUpper.type, 'photo', 'верхний регистр нормализуется → type = photo');

  const photoDoubleSpace = resolveServiceImage({ id: 'any', name: 'Тест-услуга  фото', cat: 'Брови' });
  assertEqual(photoDoubleSpace.type, 'photo', 'двойной пробел нормализуется → type = photo');

  const TEST_YO_KEY = normalizeTitle('Ёж-услуга');
  SERVICE_PHOTO_MAP[TEST_YO_KEY] = '/photos/yo-test.jpg';
  const photoYo = resolveServiceImage({ id: 'any', name: 'Ёж-услуга', cat: 'Брови' });
  const photoYe = resolveServiceImage({ id: 'any', name: 'Еж-услуга', cat: 'Брови' });
  assertEqual(photoYo.type, 'photo', 'ё в названии услуги нормализуется → type = photo');
  assertEqual(photoYe.type, 'photo', 'е-вариант тоже резолвится → type = photo');
  delete SERVICE_PHOTO_MAP[TEST_YO_KEY];
} finally {
  delete SERVICE_PHOTO_MAP[TEST_KEY];
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
