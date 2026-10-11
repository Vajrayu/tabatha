# Tabatha 1.3.3: Chrome Web Store listing text

The source text for the listing. `DASHBOARD-FILL-IN.md` (this folder) says where each piece goes. Checked against `extension/` on 11 Oct 2026.

**The Russian and Spanish texts are first drafts and must be checked by a native speaker before they are published** (especially the privacy sentences: they are promises).

## Listing history (newest first)

Only what changed is listed; the old wording is quoted so nothing is lost. The full 1.3.2 listing is in `../v1.3.2/store-listing.md`.

**1.3.3** (11 Oct 2026, update)
- **Languages:** the extension now has Russian and Spanish (`_locales/ru`, `_locales/es`). The store then shows a language picker for the listing: the Russian and Spanish descriptions below go there. The name and summary come from each language's `messages.json`:
  - ru name: `Tabatha: переключатель вкладок с живыми превью` (46/75); summary (119/132): `Alt+Tab для вкладок Chrome: живые превью, мгновенный поиск и закрытые вкладки. Бесплатно, приватно, всё остаётся у вас.`
  - es name: `Tabatha: cambiador visual de pestañas con vistas previas` (56/75); summary (132/132): `Alt+Tab para pestañas de Chrome: vistas previas, búsqueda al instante y pestañas cerradas. Gratis, privado, todo queda en tu equipo.`
  - English name and summary unchanged.
- **Description (English):** new bullets under WHAT YOU GET for sort and stars (the 8 Oct toolbar), quick actions, duplicates, the side panel with saved groups and bookmarks, the tab count on the icon, the languages. The tab-groups bullet changed: was *"Close a group, or its whole window, and Tabatha keeps it under "Saved tab groups" until you remove it; Enter brings it back as a real tab group. Turn it on from the footer: Chrome then asks for one extra permission."*, now says the saved groups are in the side panel and the switch is in the toolbar. The "Capture all previews" bullet now says it is in the toolbar (was: footer) and mentions per-card capture. PRIVATE BY DESIGN: new lines on bookmarks and on the waitlist/survey/uninstall pages. QUESTIONS: new answers about bookmarks and Pro. KEYBOARD SHORTCUTS: Alt+S (star), Alt+P (capture one), Ctrl/Cmd+click (select).
- **Privacy tab:** `storage` justification rewritten (stars, layout, nudge counters); new `bookmarks` (optional) justification; `tabs` justification adds the quick actions; `scripting` adds the "use Alt+Q" note. Data usage: consider ticking **User activity** as well (see the fill-in sheet).
- **Test instructions:** rewritten for sort, stars, quick actions and the panel.

## Description (English)
```
Too many tabs? Tabatha is a visual tab switcher for Chrome. Press Alt+Q to see live previews of every open tab, search across all your windows and reopen the tabs you just closed. It's Alt+Tab for your browser tabs, and a simple tab manager that never sends your tabs anywhere.

HOW IT WORKS
• Tap Alt+Q and Tabatha stays open. No need to keep holding anything: use the arrow keys, type to search, or click with the mouse. Enter opens a tab, Esc or a click outside closes Tabatha.
• Prefer Alt+Tab style? Hold Alt and tap Q again to move through your tabs, most recently used first, then let go to jump.
• Alt+Shift+Q moves backwards.

WHAT YOU GET
• Live previews: see a screenshot of each tab, not just its title.
• Search: start typing to filter open tabs and tabs you closed in the last 7 days, by title or address.
• Act on many at once: search, then close, copy the links (plain or as Markdown), bookmark, group, move to a new window, put to sleep, pin or mute everything it found. Or tick the tabs you want (Ctrl+click, Shift+click for a range).
• Close duplicates: one click closes pages you have open twice, keeping one of each.
• Sort your way: most recently used (like Alt+Tab), newest, oldest, A–Z, or by site, with each site in its own section. Collapse any section with a click.
• Stars: star a page to find it with the Starred filter, even after you close it.
• All your windows: tabs from every Chrome window in one view, each labelled with its site and window. Press Alt+W (or click a window chip) to narrow it to one window.
• Recently closed: reopen tabs and windows you closed in the last few hours, with a preview of what they looked like. Search reaches back 7 days, further than Chrome's own list.
• Side panel: saved tab groups and your Chrome bookmarks, side by side with your tabs. Drag a tab onto a bookmark folder, rename or move bookmarks, or open one and take it out of your bookmarks.
• Tab groups (optional): your Chrome tab groups appear as sections, with their names and colours. Close a group, or its whole window, and Tabatha keeps it in the side panel until you remove it; one click brings it back as a real tab group. Turn it on from the toolbar: Chrome then asks for one extra permission.
• Capture previews: Chrome only lets extensions screenshot the tab on screen, so a tab you haven't looked at has no preview yet. Capture one from its card, or click "Capture" in the toolbar to flip through the rest for a few seconds and come back where you were.
• Tidy up fast: press Delete (Cmd+Backspace on a Mac) or middle-click to close tabs straight from the switcher.
• Sleeping tabs: tabs Chrome puts to sleep are marked Sleeping, with their last preview faded.
• The number of open tabs on Tabatha's toolbar icon.
• In English, Russian and Spanish, following your browser's language.
• A short tour the first time you open Tabatha, and a "How it works" button whenever you want it again.
• Help when you need it: the manual, answers and a feedback form at https://tabatha-vert.vercel.app (links in the switcher's footer).
• Free, with a small Buy Me a Coffee button in the corner if you want to say thanks.
• Works everywhere: on pages extensions can't draw on (New Tab, Chrome settings, the Web Store) Tabatha opens in its own small window instead.

KEYBOARD SHORTCUTS
Alt+Q: open Tabatha / next tab
Alt+Shift+Q: previous tab
Alt+W: switch window filter
Alt+S: star the selected tab
Alt+P: capture the selected tab's preview
Enter: open the selected tab
Arrow keys: move the selection
Delete (Mac: Cmd+Backspace): close the selected tab
Ctrl+click (Mac: Cmd+click): select tabs; Shift+click selects a range
Esc: clear search or selection, or close Tabatha
Ctrl+F: jump to search

On a Mac, Alt is the Option key. You can change the shortcut at chrome://extensions/shortcuts.

PRIVATE BY DESIGN
• Previews never leave your computer. They are saved on your computer so they are still there after a restart: kept while the tab is open, and for 7 days after you close it. They are never uploaded anywhere.
• The titles and addresses of tabs you closed are kept on your computer for 7 days (never uploaded) so you can find them again.
• Saved tab groups and starred pages also stay on your computer, until you remove them.
• Bookmarks (optional) stay in Chrome: Tabatha shows and changes them when you ask, and keeps no copy.
• Old previews and entries are deleted automatically, and uninstalling Tabatha removes them.
• No accounts, no analytics, no tracking, no ads. The extension is blocked from making any network requests at all. Its buttons (Help, Feedback, the Pro waitlist, Buy Me a Coffee) simply open a web page in a new tab when you click them, and nothing is sent unless you choose to send it there.
• Tabatha does not run in Incognito windows.

WHY IT ASKS FOR ACCESS TO ALL SITES
Chrome can only take a screenshot of a tab, and show the switcher on top of a page, if the extension has access to that site. Tabatha uses that access only to capture the preview and draw the switcher. It never reads or changes what's on the page.

QUESTIONS
- Does Tabatha send my tabs or screenshots anywhere? No. Everything stays on your computer, and the extension is blocked from making network requests.
- Why does a tab have no preview? Chrome only lets extensions screenshot the tab that is on screen, so a tab gets its preview the first time you look at it. Capture one from its card, or use "Capture" in the toolbar for the rest. If no tab ever gets one, check chrome://extensions > Tabatha > Site access is "On all sites"; Tabatha tells you if it isn't.
- Why are tab groups and bookmarks separate permissions? They are optional, so Tabatha works fully without them. Chrome only asks when you turn them on.
- Is there a paid version? No. Tabatha is free. A Pro version with extras for heavy tab users is being considered: the button in the corner adds you to the waitlist.
- How do I change the Alt+Q shortcut? Open chrome://extensions/shortcuts.
- Does it work on a Mac? Yes. Alt is the Option key.

Open source: https://github.com/Vajrayu/tabatha
```

## Description (Russian, draft: needs a native speaker's check)
```
Слишком много вкладок? Tabatha — визуальный переключатель вкладок для Chrome. Нажмите Alt+Q, чтобы увидеть живые превью всех открытых вкладок, искать по всем окнам и вернуть только что закрытые вкладки. Это Alt+Tab для вкладок браузера и простой менеджер вкладок, который никуда не отправляет ваши данные.

КАК ЭТО РАБОТАЕТ
• Нажмите Alt+Q, и Tabatha останется открытой. Ничего не нужно удерживать: стрелки, поиск с клавиатуры или мышь. Enter открывает вкладку, Esc или клик мимо закрывает Tabatha.
• Привыкли к Alt+Tab? Удерживайте Alt и нажимайте Q, чтобы листать вкладки в порядке недавнего использования, затем отпустите.
• Alt+Shift+Q — в обратную сторону.

ЧТО ВЫ ПОЛУЧАЕТЕ
• Живые превью: скриншот каждой вкладки, а не только заголовок.
• Поиск: начните печатать, чтобы отфильтровать открытые вкладки и закрытые за последние 7 дней — по названию или адресу.
• Сразу несколько: найдите вкладки и закройте, скопируйте ссылки (обычным текстом или в Markdown), добавьте в закладки, сгруппируйте, перенесите в новое окно, усыпите, закрепите или выключите звук у всего найденного. Или отметьте нужные (Ctrl+клик, Shift+клик для диапазона).
• Дубликаты: один клик закрывает страницы, открытые дважды, оставляя по одной.
• Сортировка: по недавнему использованию (как Alt+Tab), новые, старые, А–Я или по сайтам — каждый сайт в своём разделе. Любой раздел сворачивается одним кликом.
• Избранное: отметьте страницу звёздочкой, чтобы найти её через фильтр «Избранное», даже после закрытия.
• Все окна: вкладки из всех окон Chrome на одном экране. Alt+W (или кнопка окна) оставляет одно окно.
• Недавно закрытые: возвращайте вкладки и окна, закрытые за последние часы, с превью. Поиск охватывает 7 дней — больше, чем собственный список Chrome.
• Боковая панель: сохранённые группы вкладок и закладки Chrome рядом с вкладками. Перетащите вкладку в папку закладок, переименуйте или переместите закладку, откройте её и уберите из закладок.
• Группы вкладок (по желанию): группы Chrome становятся разделами с их названиями и цветами. Закройте группу или всё окно — Tabatha сохранит её в боковой панели, пока вы её не удалите; один клик вернёт настоящую группу. Включается в панели инструментов: Chrome попросит одно дополнительное разрешение.
• Превью: Chrome разрешает расширениям снимать только видимую вкладку, поэтому у непросмотренной вкладки превью ещё нет. Снимите его с карточки или нажмите «Снять» на панели — Tabatha за несколько секунд пролистает остальные и вернёт вас обратно.
• Быстрая уборка: Delete (Cmd+Backspace на Mac) или клик средней кнопкой закрывает вкладки прямо из переключателя.
• Спящие вкладки: вкладки, которые Chrome выгрузил, помечены «Спит», их последнее превью приглушено.
• Число открытых вкладок на значке Tabatha.
• На русском, английском и испанском — по языку браузера.
• Короткий тур при первом запуске и кнопка «Как это работает», когда захотите повторить.
• Помощь: руководство, ответы и форма обратной связи на https://tabatha-vert.vercel.app (ссылки внизу переключателя).
• Бесплатно. В углу есть небольшая кнопка «Угостить кофе», если захотите сказать спасибо.
• Работает везде: на страницах, где расширениям нельзя рисовать (новая вкладка, настройки Chrome, Web Store), Tabatha открывается в своём маленьком окне.

ГОРЯЧИЕ КЛАВИШИ
Alt+Q: открыть Tabatha / следующая вкладка
Alt+Shift+Q: предыдущая вкладка
Alt+W: сменить фильтр окна
Alt+S: в избранное
Alt+P: снять превью выбранной вкладки
Enter: открыть выбранную вкладку
Стрелки: перемещать выбор
Delete (Mac: Cmd+Backspace): закрыть выбранную вкладку
Ctrl+клик (Mac: Cmd+клик): выбрать вкладки; Shift+клик — диапазон
Esc: очистить поиск или выбор, или закрыть Tabatha
Ctrl+F: перейти к поиску

На Mac клавиша Alt — это Option. Сочетание можно изменить на странице chrome://extensions/shortcuts.

ПРИВАТНОСТЬ
• Превью никогда не покидают ваш компьютер. Они хранятся на нём, чтобы пережить перезапуск: пока вкладка открыта и 7 дней после закрытия. Никуда не загружаются.
• Названия и адреса закрытых вкладок хранятся на компьютере 7 дней (никуда не загружаются), чтобы вы могли их найти.
• Сохранённые группы и избранное тоже остаются на компьютере, пока вы их не удалите.
• Закладки (по желанию) остаются в Chrome: Tabatha показывает и меняет их по вашей просьбе и не хранит копий.
• Старые превью и записи удаляются автоматически, а при удалении Tabatha удаляется всё.
• Без аккаунтов, аналитики, слежки и рекламы. Расширению запрещено делать какие-либо сетевые запросы. Его кнопки (Помощь, Отзыв, список ожидания Pro, кофе) просто открывают страницу в новой вкладке, и ничего не отправляется, пока вы сами этого не решите.
• Tabatha не работает в окнах инкогнито.

ЗАЧЕМ ДОСТУП КО ВСЕМ САЙТАМ
Chrome позволяет сделать скриншот вкладки и показать переключатель поверх страницы, только если у расширения есть доступ к этому сайту. Tabatha использует этот доступ только для превью и для показа переключателя. Она никогда не читает и не меняет содержимое страницы.

ВОПРОСЫ
- Отправляет ли Tabatha мои вкладки или скриншоты? Нет. Всё остаётся на компьютере, а сетевые запросы расширению запрещены.
- Почему у вкладки нет превью? Chrome разрешает снимать только видимую вкладку, поэтому превью появляется, когда вы впервые на неё посмотрите. Снимите его с карточки или нажмите «Снять» на панели. Если превью не появляется ни у одной вкладки, проверьте chrome://extensions > Tabatha > «Доступ к сайтам» — «На всех сайтах»; Tabatha подскажет, если это не так.
- Почему группы вкладок и закладки — отдельные разрешения? Они необязательны, Tabatha полностью работает и без них. Chrome спросит только тогда, когда вы их включите.
- Есть ли платная версия? Нет, Tabatha бесплатна. Версия Pro с возможностями для тех, у кого много вкладок, пока обсуждается: кнопка в углу запишет вас в список ожидания.
- Как изменить Alt+Q? Откройте chrome://extensions/shortcuts.
- Работает ли на Mac? Да. Alt — это Option.

Открытый исходный код: https://github.com/Vajrayu/tabatha
```

## Description (Spanish, draft: needs a native speaker's check)
```
¿Demasiadas pestañas? Tabatha es un cambiador visual de pestañas para Chrome. Pulsa Alt+Q para ver vistas previas en vivo de todas tus pestañas abiertas, buscar en todas tus ventanas y recuperar las pestañas que acabas de cerrar. Es Alt+Tab para las pestañas del navegador, y un gestor de pestañas sencillo que nunca envía tus pestañas a ningún sitio.

CÓMO FUNCIONA
• Pulsa Alt+Q y Tabatha se queda abierta. No hace falta mantener nada pulsado: usa las flechas, escribe para buscar o haz clic. Intro abre una pestaña; Esc o un clic fuera cierra Tabatha.
• ¿Prefieres el estilo Alt+Tab? Mantén Alt y pulsa Q otra vez para recorrer tus pestañas, las más recientes primero, y suelta para saltar.
• Alt+Mayús+Q va hacia atrás.

QUÉ OBTIENES
• Vistas previas en vivo: una captura de cada pestaña, no solo su título.
• Búsqueda: empieza a escribir para filtrar pestañas abiertas y las cerradas en los últimos 7 días, por título o dirección.
• Varias a la vez: busca y luego cierra, copia los enlaces (en texto o en Markdown), guarda en marcadores, agrupa, mueve a una ventana nueva, duerme, fija o silencia todo lo que encontró. O marca las que quieras (Ctrl+clic, Mayús+clic para un rango).
• Duplicadas: un clic cierra las páginas que tienes abiertas dos veces y deja una de cada.
• Ordena a tu manera: por uso reciente (como Alt+Tab), más nuevas, más antiguas, A–Z o por sitio, cada sitio en su sección. Contrae cualquier sección con un clic.
• Destacadas: destaca una página para encontrarla con el filtro Destacadas, incluso después de cerrarla.
• Todas tus ventanas: pestañas de todas las ventanas de Chrome en una sola vista. Alt+W (o un clic en una ventana) deja solo una.
• Cerradas recientemente: recupera pestañas y ventanas cerradas en las últimas horas, con su vista previa. La búsqueda llega a 7 días, más que la lista de Chrome.
• Panel lateral: grupos guardados y tus marcadores de Chrome, junto a tus pestañas. Arrastra una pestaña a una carpeta, cambia el nombre o mueve marcadores, o abre uno y quítalo de tus marcadores.
• Grupos de pestañas (opcional): tus grupos de Chrome aparecen como secciones, con su nombre y color. Cierra un grupo, o su ventana entera, y Tabatha lo guarda en el panel lateral hasta que lo quites; un clic lo recupera como grupo real. Se activa desde la barra de herramientas: Chrome pedirá un permiso más.
• Vistas previas: Chrome solo deja a las extensiones capturar la pestaña visible, así que una pestaña que no has mirado aún no tiene vista previa. Captúrala desde su tarjeta, o pulsa «Capturar» en la barra para recorrer el resto en unos segundos y volver a donde estabas.
• Ordena rápido: Supr (Cmd+Retroceso en Mac) o clic central cierra pestañas desde el cambiador.
• Pestañas dormidas: las que Chrome descarga aparecen como Dormida, con su última vista previa atenuada.
• El número de pestañas abiertas en el icono de Tabatha.
• En español, inglés y ruso, según el idioma de tu navegador.
• Un recorrido breve la primera vez y un botón «Cómo funciona» cuando quieras repetirlo.
• Ayuda cuando la necesites: el manual, respuestas y un formulario de comentarios en https://tabatha-vert.vercel.app (enlaces al pie del cambiador).
• Gratis, con un pequeño botón «Invítame a un café» en la esquina si quieres dar las gracias.
• Funciona en todas partes: en las páginas donde las extensiones no pueden dibujar (Nueva pestaña, ajustes de Chrome, Web Store) Tabatha se abre en su propia ventana pequeña.

ATAJOS DE TECLADO
Alt+Q: abrir Tabatha / pestaña siguiente
Alt+Mayús+Q: pestaña anterior
Alt+W: cambiar el filtro de ventana
Alt+S: destacar la pestaña seleccionada
Alt+P: capturar la vista previa de la pestaña seleccionada
Intro: abrir la pestaña seleccionada
Flechas: mover la selección
Supr (Mac: Cmd+Retroceso): cerrar la pestaña seleccionada
Ctrl+clic (Mac: Cmd+clic): seleccionar pestañas; Mayús+clic, un rango
Esc: borrar la búsqueda o la selección, o cerrar Tabatha
Ctrl+F: ir a la búsqueda

En Mac, Alt es la tecla Opción. Puedes cambiar el atajo en chrome://extensions/shortcuts.

PRIVADA POR DISEÑO
• Las vistas previas nunca salen de tu ordenador. Se guardan en él para que sigan ahí tras reiniciar: mientras la pestaña está abierta y 7 días después de cerrarla. Nunca se suben a ningún sitio.
• Los títulos y direcciones de las pestañas cerradas se guardan en tu ordenador 7 días (nunca se suben) para que puedas encontrarlas.
• Los grupos guardados y las páginas destacadas también se quedan en tu ordenador hasta que los quites.
• Los marcadores (opcional) se quedan en Chrome: Tabatha los muestra y cambia cuando se lo pides, y no guarda copia.
• Las vistas previas y entradas antiguas se borran solas, y al desinstalar Tabatha se elimina todo.
• Sin cuentas, sin analítica, sin rastreo, sin anuncios. La extensión tiene prohibido hacer cualquier petición de red. Sus botones (Ayuda, Comentarios, la lista de espera Pro, el café) solo abren una página en una pestaña nueva al pulsarlos, y no se envía nada salvo lo que tú decidas enviar allí.
• Tabatha no funciona en ventanas de incógnito.

POR QUÉ PIDE ACCESO A TODOS LOS SITIOS
Chrome solo deja capturar una pestaña, y mostrar el cambiador encima de una página, si la extensión tiene acceso a ese sitio. Tabatha usa ese acceso solo para la vista previa y para dibujar el cambiador. Nunca lee ni cambia el contenido de la página.

PREGUNTAS
- ¿Tabatha envía mis pestañas o capturas a algún sitio? No. Todo se queda en tu ordenador, y la extensión no puede hacer peticiones de red.
- ¿Por qué una pestaña no tiene vista previa? Chrome solo deja capturar la pestaña visible, así que la vista previa aparece la primera vez que la miras. Captúrala desde su tarjeta o usa «Capturar» en la barra. Si ninguna pestaña la consigue, comprueba en chrome://extensions > Tabatha que «Acceso a sitios» está en «En todos los sitios»; Tabatha te avisa si no.
- ¿Por qué los grupos y los marcadores son permisos aparte? Son opcionales: Tabatha funciona del todo sin ellos. Chrome solo pregunta cuando los activas.
- ¿Hay una versión de pago? No, Tabatha es gratis. Se está pensando en una versión Pro con extras para quien usa muchas pestañas: el botón de la esquina te apunta a la lista de espera.
- ¿Cómo cambio el atajo Alt+Q? Abre chrome://extensions/shortcuts.
- ¿Funciona en Mac? Sí. Alt es la tecla Opción.

Código abierto: https://github.com/Vajrayu/tabatha
```
