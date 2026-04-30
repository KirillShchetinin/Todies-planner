const TRANSLATIONS = {
  en: {
    appTitle:           'weekly planner',
    hint:               'drag to reorder · dbl-click = done · right-click label = edit',
    addDay:             '+ add day',
    addUnscheduled:     '+ unscheduled',
    addDayLabelPh:      'Mon',
    addDayDatePh:       '04/28',
    addDayConfirm:      'add',
    addDayCancel:       'cancel',
    addTask:            '+ add task',
    addTaskPh:          'task name…',
    addLabel:           '+ label',
    newLabelTitle:      'new label',
    newLabelPh:         'label name...',
    newLabelConfirm:    'add',
    newLabelCancel:     'cancel',
    ctxEditTask:        'edit name',
    ctxEditTaskPrompt:  'Task name:',
    ctxMarkImportant:   '! mark important',
    ctxUnmarkImportant: '! unmark important',
    ctxChangeType:      'change type',
    ctxRename:          'rename',
    ctxDelete:          'delete',
    ctxRenamePrompt:    'New name:',
    removeColTitle:     'remove column',
    ghostTitle:         'Double-click to add next day',
    deleteColConfirm:   'Delete column and all its tasks?',
    dayFallback:        'Day',
    dayLocale:          'en-US',
    scaleLarger:        'Larger',
    scaleSmaller:       'Smaller',
  },
  ru: {
    appTitle:           'планировщик недели',
    hint:               'перетащить для сортировки · двойной клик = готово · правый клик на метке = редактировать',
    addDay:             '+ добавить день',
    addUnscheduled:     '+ без даты',
    addDayLabelPh:      'Пн',
    addDayDatePh:       '28.04',
    addDayConfirm:      'добавить',
    addDayCancel:       'отмена',
    addTask:            '+ задача',
    addTaskPh:          'название задачи…',
    addLabel:           '+ метка',
    newLabelTitle:      'новая метка',
    newLabelPh:         'название метки...',
    newLabelConfirm:    'добавить',
    newLabelCancel:     'отмена',
    ctxEditTask:        'изменить название',
    ctxEditTaskPrompt:  'Название задачи:',
    ctxMarkImportant:   '! отметить важным',
    ctxUnmarkImportant: '! снять отметку важного',
    ctxChangeType:      'изменить тип',
    ctxRename:          'переименовать',
    ctxDelete:          'удалить',
    ctxRenamePrompt:    'Новое название:',
    removeColTitle:     'удалить колонку',
    ghostTitle:         'Двойной клик — добавить следующий день',
    deleteColConfirm:   'Удалить колонку со всеми задачами?',
    dayFallback:        'День',
    dayLocale:          'ru-RU',
    scaleLarger:        'Крупнее',
    scaleSmaller:       'Мельче',
  },
};

let lang = 'en';

function t(key) { return (TRANSLATIONS[lang] || TRANSLATIONS.en)[key] || key; }

const DAY_LABEL_RU = {
  'Mon':'Пн', 'Tue':'Вт', 'Wed':'Ср', 'Thu':'Чт', 'Fri':'Пт', 'Sat':'Сб', 'Sun':'Вс',
  'Monday':'Понедельник', 'Tuesday':'Вторник', 'Wednesday':'Среда',
  'Thursday':'Четверг', 'Friday':'Пятница', 'Saturday':'Суббота', 'Sunday':'Воскресенье',
};

function translateLabel(label) {
  if (lang === 'ru' && DAY_LABEL_RU[label]) return DAY_LABEL_RU[label];
  return label;
}

function applyLangToStaticUI() {
  const title = document.getElementById('appTitle');
  if (title) title.textContent = t('appTitle');
  const hint = document.getElementById('appHint');
  if (hint) hint.textContent = t('hint');
  const addDayBtn = document.getElementById('addDayBtn');
  if (addDayBtn) addDayBtn.textContent = t('addDay');
  const addUnschBtn = document.getElementById('addUnscheduledBtn');
  if (addUnschBtn) addUnschBtn.textContent = t('addUnscheduled');
  const newDayLabel = document.getElementById('newDayLabel');
  if (newDayLabel) newDayLabel.placeholder = t('addDayLabelPh');
  const newDayDate = document.getElementById('newDayDate');
  if (newDayDate) newDayDate.placeholder = t('addDayDatePh');
  const addDayConfirm = document.getElementById('addDayConfirm');
  if (addDayConfirm) addDayConfirm.textContent = t('addDayConfirm');
  const addDayCancel = document.getElementById('addDayCancel');
  if (addDayCancel) addDayCancel.textContent = t('addDayCancel');
  // add label panel
  const panelTitle = addPanel?.querySelector('.add-panel-title');
  if (panelTitle) panelTitle.textContent = t('newLabelTitle');
  const newLabelName = addPanel?.querySelector('#newLabelName');
  if (newLabelName) newLabelName.placeholder = t('newLabelPh');
  const newLabelConfirm = addPanel?.querySelector('#newLabelConfirm');
  if (newLabelConfirm) newLabelConfirm.textContent = t('newLabelConfirm');
  const newLabelCancel = addPanel?.querySelector('#newLabelCancel');
  if (newLabelCancel) newLabelCancel.textContent = t('newLabelCancel');
  // lang button label
  const langBtn = document.getElementById('langBtn');
  if (langBtn) langBtn.textContent = lang.toUpperCase();
}
