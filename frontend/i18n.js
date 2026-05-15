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
    ctxCancel:          '✕ cancel task',
    ctxUncancel:        '✕ uncancel task',
    ctxChangeType:      'change type',
    ctxRename:          'rename',
    ctxDelete:          'delete',
    ctxRenamePrompt:    'New name:',
    removeColTitle:     'remove column',
    ghostTitle:         'Double-click to add next day',
    deleteColConfirm:   'Delete column and all its tasks?',
    deleteColHasTasks:  'Remove all tasks before deleting this column.',
    dayFallback:        'Day',
    dayLocale:          'en-US',
    scaleLarger:        'Larger',
    scaleSmaller:       'Smaller',
    actAccount:         'Account',
    actLabels:          'Labels',
    actSettings:        'Settings',
    actInstructions:    'Help',
    accountAdd:              'Add account',
    accountRefreshToken:     'Refresh Token',
    accountDelete:           'Delete Account',
    accountDeleteConfirm:    'Delete this account? This cannot be undone.',
    accountDeleteFailed:     'Failed to delete account.',
    accountRefreshConfirm:   'Replace your current token with a new one? Your old token will stop working.',
    accountRefreshFailed:    'Failed to refresh token.',
    accountCreateFailed:     'Failed to create account.',
    modalCancel:             'cancel',
    modalDelete:             'delete',
    modalOk:                 'ok',
    tokenModalMsg:           'Your token — save it, it cannot be recovered:',
    tokenCopy:               'copy',
    tokenCopied:             'copied',
    tokenDone:               'done',
    mobQuickAdd:             'quick add…',
    mobToday:                'TODAY',
    mobEmpty:                'empty',
    mobUnscheduled:          'unscheduled',
    mobUnsch:                'Unsch',
    mobMoveTo:               'MOVE TO',
    mobMarkDone:             'Mark done',
    mobMarkImportant:        'Mark important',
    mobCancelTask:           'Cancel task',
    mobDelete:               'Delete',
    mobStep1:                '1 · PICK A LABEL',
    mobStep2:                '2 · NAME',
    mobAddHint:              '↵ add & close  ·  ⇧↵ add & keep open',
    mobSignedIn:             'SIGNED IN',
    mobUser:                 'User',
    mobAnonymous:            'Anonymous',
    mobAccount:              'ACCOUNT',
    mobSchedule:             'schedule',
    mobTasksWaiting:         'tasks waiting',
    mobUnschedHint:          'tap "schedule" or long-press to move to a day',
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
    ctxCancel:          '✕ отменить задачу',
    ctxUncancel:        '✕ снять отмену',
    ctxChangeType:      'изменить тип',
    ctxRename:          'переименовать',
    ctxDelete:          'удалить',
    ctxRenamePrompt:    'Новое название:',
    removeColTitle:     'удалить колонку',
    ghostTitle:         'Двойной клик — добавить следующий день',
    deleteColConfirm:   'Удалить колонку со всеми задачами?',
    deleteColHasTasks:  'Удалите все задачи перед удалением колонки.',
    dayFallback:        'День',
    dayLocale:          'ru-RU',
    scaleLarger:        'Крупнее',
    scaleSmaller:       'Мельче',
    actAccount:         'Аккаунт',
    actLabels:          'Метки задач',
    actSettings:        'Настройки',
    actInstructions:    'Помощь',
    accountAdd:              'Добавить аккаунт',
    accountRefreshToken:     'Обновить токен',
    accountDelete:           'Удалить',
    accountDeleteConfirm:    'Удалить этот аккаунт? Это действие необратимо.',
    accountDeleteFailed:     'Не удалось удалить аккаунт.',
    accountRefreshConfirm:   'Заменить текущий токен новым? Старый токен перестанет работать.',
    accountRefreshFailed:    'Не удалось обновить токен.',
    accountCreateFailed:     'Не удалось создать аккаунт.',
    modalCancel:             'отмена',
    modalDelete:             'удалить',
    modalOk:                 'ок',
    tokenModalMsg:           'Ваш токен — сохраните его, он не восстанавливается:',
    tokenCopy:               'скопировать',
    tokenCopied:             'скопировано',
    tokenDone:               'готово',
    mobQuickAdd:             'быстро добавить…',
    mobToday:                'СЕГОДНЯ',
    mobEmpty:                'пусто',
    mobUnscheduled:          'без даты',
    mobUnsch:                'Без д.',
    mobMoveTo:               'ПЕРЕМЕСТИТЬ В',
    mobMarkDone:             'Отметить выполненным',
    mobMarkImportant:        'Отметить важным',
    mobCancelTask:           'Отменить задачу',
    mobDelete:               'Удалить',
    mobStep1:                '1 · ВЫБЕРИ МЕТКУ',
    mobStep2:                '2 · НАЗВАНИЕ',
    mobAddHint:              '↵ добавить  ·  ⇧↵ добавить ещё',
    mobSignedIn:             'АККАУНТ',
    mobUser:                 'Пользователь',
    mobAnonymous:            'Анонимно',
    mobAccount:              'УПРАВЛЕНИЕ',
    mobSchedule:             'запланировать',
    mobTasksWaiting:         'задач ждут',
    mobUnschedHint:          'нажми "запланировать" или удерживай для перемещения',
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
  // account panel buttons
  const accountAddBtn = document.getElementById('accountAddBtn');
  if (accountAddBtn) accountAddBtn.textContent = t('accountAdd');
  const accountRefreshTokenBtn = document.getElementById('accountRefreshTokenBtn');
  if (accountRefreshTokenBtn) accountRefreshTokenBtn.textContent = t('accountRefreshToken');
  const accountDeleteBtn = document.getElementById('accountDeleteBtn');
  if (accountDeleteBtn) accountDeleteBtn.textContent = t('accountDelete');
  // actbar labels
  ['actAccount', 'actLabels', 'actSettings', 'actInstructions'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.querySelector('.act-label').textContent = t(id);
  });
  // lang button label
  const langBtn = document.getElementById('langBtn');
  if (langBtn) langBtn.textContent = lang.toUpperCase();
}
