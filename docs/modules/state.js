export let SERVICES_DATA = [
  { id: 'svc1',  name: 'Перманентный макияж бровей',      cat: 'Брови',    dur: 120, priceStr: 'от 8 000 ₽' },
  { id: 'svc2',  name: 'Перманентный макияж губ',          cat: 'Губы',     dur: 150, priceStr: 'от 10 000 ₽' },
  { id: 'svc3',  name: 'Перманентный макияж век',          cat: 'Глаза',    dur: 120, priceStr: 'от 7 000 ₽' },
  { id: 'svc4',  name: 'Микроблейдинг бровей',             cat: 'Брови',    dur: 150, priceStr: 'от 9 000 ₽' },
  { id: 'svc5',  name: 'Коррекция ПМ бровей',              cat: 'Брови',    dur: 90,  priceStr: 'от 4 000 ₽' },
  { id: 'svc6',  name: 'Оформление бровей хной',           cat: 'Брови',    dur: 45,  priceStr: '1 800 ₽' },
  { id: 'svc7',  name: 'Шугаринг ног',                     cat: 'Эпиляция', dur: 60,  priceStr: '2 200 ₽' },
  { id: 'svc8',  name: 'Шугаринг бикини глубокое',         cat: 'Эпиляция', dur: 60,  priceStr: '2 800 ₽' },
  { id: 'svc9',  name: 'Шугаринг подмышек',                cat: 'Эпиляция', dur: 20,  priceStr: '800 ₽' },
  { id: 'svc10', name: 'Воск: руки / живот',               cat: 'Эпиляция', dur: 30,  priceStr: '1 200 ₽' },
  { id: 'svc11', name: 'Наращивание ресниц',                cat: 'Глаза',    dur: 120, priceStr: '4 500 ₽' },
  { id: 'svc12', name: 'Лифтинг и ламинирование ресниц',   cat: 'Глаза',    dur: 90,  priceStr: '3 800 ₽' },
  { id: 'svc13', name: 'Ламинирование бровей',              cat: 'Брови',    dur: 60,  priceStr: '3 500 ₽' },
];

export let MASTERS_DATA = [
  { id: 'm1', ycId: '5443758', name: 'Мария Соколова',  short: 'Мария С.',  role: 'Мастер ПМ и бровей', exp: '7 лет',  emoji: '👩', grad: 'linear-gradient(135deg,#F4B8CF,#E8729A)', cats: ['Брови', 'Губы', 'Глаза'],    fav: true,  avail: true,  availText: '● Есть окна сегодня' },
  { id: 'm2', ycId: '5443764', name: 'Ольга Климова',   short: 'Ольга К.',  role: 'Мастер эпиляции',    exp: '5 лет',  emoji: '👩', grad: 'linear-gradient(135deg,#B8EFE0,#6DC9AF)', cats: ['Эпиляция'],                  fav: false, avail: false, availText: 'Ближайшее окно — 27 мая' },
  { id: 'm3', ycId: '5443767', name: 'Мила Романова',   short: 'Мила Р.',   role: 'Мастер ресниц',      exp: '4 года', emoji: '👩', grad: 'linear-gradient(135deg,#EDACC3,#C8547F)', cats: ['Глаза'],                     fav: false, avail: true,  availText: '● Есть окна сегодня' },
  { id: 'm4', ycId: null,      name: 'Дарья Михайлова', short: 'Дарья М.',  role: 'Мастер ПМ',          exp: '3 года', emoji: '👩', grad: 'linear-gradient(135deg,#C5F0E4,#72C8B0)', cats: ['Брови', 'Губы', 'Глаза'],    fav: false, avail: true,  availText: '● Есть окна сегодня' },
];

export function setServicesData(data) { SERVICES_DATA = data; }
export function setMastersData(data) { MASTERS_DATA = data; }

export const state = {
  category: 'Все',
  searchQ: '',
  serviceId: 'svc1',
  masterId: 'm1',
  dateFull: new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }),
  dateISO: '',
  slot: '14:00',
  _bookAfterLogin: false,
  _bookOtherName: '',
  _bookOtherPhone: '',
  _cancelId: null,
  _cancelHash: null,
  _rescheduleId: null,
  _reviewMasterId: null,
  _reviewMasterName: '',
  _reviewSvcName: '',
  _reviewRecordDate: '',
};

export function getService() {
  return SERVICES_DATA.find(s => s.id === state.serviceId) || SERVICES_DATA[0];
}

export function getMaster() {
  return state.masterId ? MASTERS_DATA.find(m => m.id === state.masterId) : null;
}
