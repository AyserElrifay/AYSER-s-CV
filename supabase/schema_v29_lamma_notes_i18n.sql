-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE LINE THAT TEACHES, IN ALL FIVE
--
--  The note after each answer existed in Arabic and English, and the
--  other three languages read the English one. That was the honest
--  stopgap and it was written down as one; this is the other three,
--  written rather than machine-translated, because these lines are
--  read out at a table and a sentence that drifts is worse than no
--  sentence.
--
--  Fifty-three questions, French, Spanish and Romanian.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

update public.questions set note_i18n = '{"fr": "Une pyramide était un tombeau : le roi y était enterré avec tout ce qu’il lui fallait ensuite.", "es": "Una pirámide era una tumba: el rey se enterraba con todo lo que necesitaría después.", "ro": "O piramidă era un mormânt: regele era îngropat cu tot ce-i trebuia dincolo."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 0;
update public.questions set note_i18n = '{"fr": "Le Nil traverse onze pays avant d’arriver en Égypte.", "es": "El Nilo atraviesa once países antes de llegar a Egipto.", "ro": "Nilul trece prin unsprezece țări înainte să ajungă în Egipt."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 1;
update public.questions set note_i18n = '{"fr": "Le Caire est la plus grande ville d’Afrique et du monde arabe : plus de 20 millions d’habitants.", "es": "El Cairo es la mayor ciudad de África y del mundo árabe: más de 20 millones.", "ro": "Cairo e cel mai mare oraș din Africa și din lumea arabă: peste 20 de milioane."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 2;
update public.questions set note_i18n = '{"fr": "Toutânkhamon devient roi à neuf ans et meurt à dix-huit ; sa tombe fut retrouvée presque intacte.", "es": "Tutankamón fue rey a los nueve años y murió a los dieciocho; su tumba apareció casi intacta.", "ro": "Tutankhamon a ajuns rege la nouă ani și a murit la optsprezece; mormântul i-a fost găsit aproape intact."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 3;
update public.questions set note_i18n = '{"fr": "Cléopâtre vivait plus près de notre époque que de la construction des pyramides.", "es": "Cleopatra vivió más cerca de nuestra época que de la construcción de las pirámides.", "ro": "Cleopatra a trăit mai aproape de vremea noastră decât de construcția piramidelor."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 4;
update public.questions set note_i18n = '{"fr": "Cléopâtre parlait plusieurs langues et fut la dernière souveraine de l’Égypte antique avant Rome.", "es": "Cleopatra hablaba varios idiomas y fue la última gobernante del Egipto antiguo antes de Roma.", "ro": "Cleopatra vorbea mai multe limbi și a fost ultima conducătoare a Egiptului antic înainte de Roma."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 5;
update public.questions set note_i18n = '{"fr": "Le Sphinx est taillé dans un seul bloc : environ 73 mètres de lion à tête humaine.", "es": "La Esfinge está tallada en una sola roca: unos 73 metros de león con cabeza humana.", "ro": "Sfinxul e sculptat dintr-o singură stâncă: vreo 73 de metri de leu cu cap de om."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 6;
update public.questions set note_i18n = '{"fr": "Les hiéroglyphes sont restés illisibles plus de mille ans, jusqu’en 1822.", "es": "Los jeroglíficos quedaron ilegibles más de mil años, hasta 1822.", "ro": "Hieroglifele au rămas necitite peste o mie de ani, până în 1822."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 7;
update public.questions set note_i18n = '{"fr": "La pierre de Rosette porte le même texte de trois façons : c’est ce qui a permis de déchiffrer.", "es": "La piedra de Rosetta lleva el mismo texto de tres formas: eso permitió descifrarlos.", "ro": "Piatra din Rosetta poartă același text în trei feluri: asta a permis descifrarea."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 8;
update public.questions set note_i18n = '{"fr": "Le canal de Suez épargne à un navire environ 7 000 km autour de l’Afrique.", "es": "El canal de Suez le ahorra a un barco unos 7.000 km rodeando África.", "ro": "Canalul Suez scutește o navă de vreo 7.000 km în jurul Africii."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 9;
update public.questions set note_i18n = '{"fr": "Les récifs de corail font de la mer Rouge l’un des meilleurs sites de plongée au monde.", "es": "Los arrecifes de coral hacen del mar Rojo uno de los mejores sitios de buceo del mundo.", "ro": "Recifele de corali fac din Marea Roșie unul dintre cele mai bune locuri de scufundări."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 10;
update public.questions set note_i18n = '{"fr": "Alexandre fonde Alexandrie en 331 av. J.-C. et lui donne son nom.", "es": "Alejandro fundó Alejandría en el 331 a. C. y le puso su nombre.", "ro": "Alexandru a fondat Alexandria în 331 î.Hr. și i-a dat numele lui."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 11;
update public.questions set note_i18n = '{"fr": "Le phare a tenu environ 1 600 ans avant que des séismes ne l’abattent.", "es": "El faro resistió unos 1.600 años hasta que los terremotos lo derribaron.", "ro": "Farul a rezistat vreo 1.600 de ani până l-au doborât cutremurele."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 12;
update public.questions set note_i18n = '{"fr": "Mohamed Salah vient d’un village du delta du Nil appelé Nagrig.", "es": "Mohamed Salah es de un pueblo del delta del Nilo llamado Nagrig.", "ro": "Mohamed Salah e dintr-un sat din delta Nilului, Nagrig."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 13;
update public.questions set note_i18n = '{"fr": "Le koshari est le plat de rue égyptien : des idées indiennes, italiennes et égyptiennes dans un bol.", "es": "El koshari es la comida callejera de Egipto: ideas indias, italianas y egipcias en un bol.", "ro": "Koshari e mâncarea de stradă a Egiptului: idei indiene, italiene și egiptene într-un bol."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 14;
update public.questions set note_i18n = '{"fr": "Le papyrus fut le premier papier du monde, et l’Égypte l’exportait dans toute la Méditerranée.", "es": "El papiro fue el primer papel del mundo, y Egipto lo exportaba por todo el Mediterráneo.", "ro": "Papirusul a fost prima hârtie din lume, iar Egiptul o exporta în toată Mediterana."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 15;
update public.questions set note_i18n = '{"fr": "Environ 96 % de l’Égypte est désertique ; presque tout le monde vit sur une bande étroite le long du Nil.", "es": "Cerca del 96% de Egipto es desierto; casi todos viven en una franja junto al Nilo.", "ro": "Circa 96% din Egipt e deșert; aproape toți trăiesc pe o fâșie îngustă lângă Nil."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 16;
update public.questions set note_i18n = '{"fr": "Le haut barrage a mis fin aux crues ; le lac Nasser derrière lui est l’un des plus grands lacs artificiels.", "es": "La presa alta acabó con las crecidas; el lago Nasser es uno de los mayores lagos artificiales.", "ro": "Barajul a oprit inundațiile; Lacul Nasser e unul dintre cele mai mari lacuri artificiale."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 17;
update public.questions set note_i18n = '{"fr": "Abou Simbel a été découpé et déplacé bloc par bloc pour que le barrage ne le noie pas.", "es": "Abu Simbel se cortó y se trasladó bloque a bloque para que la presa no lo inundara.", "ro": "Abu Simbel a fost tăiat și mutat bloc cu bloc, ca să nu-l înece barajul."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 18;
update public.questions set note_i18n = '{"fr": "La livre égyptienne se divise en 100 piastres — le mot sert encore tous les jours.", "es": "La libra egipcia se divide en 100 piastras, palabra que aún se usa a diario.", "ro": "Lira egipteană se împarte în 100 de piaștri — cuvântul se folosește și azi."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 19;
update public.questions set note_i18n = '{"fr": "La grande pyramide fut le plus haut bâtiment du monde pendant environ 3 800 ans.", "es": "La Gran Pirámide fue el edificio más alto del mundo unos 3.800 años.", "ro": "Marea Piramidă a fost cea mai înaltă clădire din lume vreo 3.800 de ani."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 20;
update public.questions set note_i18n = '{"fr": "L’arabe est la langue officielle ; le dialecte égyptien se comprend dans tout le monde arabe.", "es": "El árabe es la lengua oficial; el dialecto egipcio se entiende en todo el mundo árabe.", "ro": "Araba e limba oficială; dialectul egiptean se înțelege în toată lumea arabă."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 21;
update public.questions set note_i18n = '{"fr": "Les pyramides datent d’environ 2560 av. J.-C., des milliers d’années avant Rome.", "es": "Las pirámides son de hacia el 2560 a. C., miles de años antes de Roma.", "ro": "Piramidele sunt din jur de 2560 î.Hr., cu milenii înainte de Roma."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 22;
update public.questions set note_i18n = '{"fr": "À partir de 30 av. J.-C., l’Égypte est une province romaine — et le grenier qui nourrit Rome.", "es": "Desde el 30 a. C. Egipto fue provincia romana, y el granero que alimentaba a Roma.", "ro": "Din 30 î.Hr. Egiptul a fost provincie romană — și grânarul care hrănea Roma."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 23;
update public.questions set note_i18n = '{"fr": "Le canal ouvre en 1869, creusé surtout par des dizaines de milliers d’ouvriers égyptiens.", "es": "El canal abrió en 1869, excavado sobre todo por decenas de miles de obreros egipcios.", "ro": "Canalul s-a deschis în 1869, săpat mai ales de zeci de mii de muncitori egipteni."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 24;
update public.questions set note_i18n = '{"fr": "La révolution de juillet 1952 met fin à la monarchie ; la république suit un an après.", "es": "La revolución de julio de 1952 acabó con la monarquía; la república llegó un año después.", "ro": "Revoluția din iulie 1952 a pus capăt monarhiei; republica a urmat un an mai târziu."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 25;
update public.questions set note_i18n = '{"fr": "Nasser nationalise le canal en 1956 ; le haut barrage est achevé en 1970.", "es": "Nasser nacionalizó el canal en 1956; la presa alta se terminó en 1970.", "ro": "Nasser a naționalizat canalul în 1956; barajul a fost gata în 1970."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 26;
update public.questions set note_i18n = '{"fr": "La bibliothèque d’Alexandrie voulait un exemplaire de chaque livre du monde.", "es": "La biblioteca de Alejandría quería un ejemplar de cada libro del mundo.", "ro": "Biblioteca din Alexandria voia un exemplar din fiecare carte a lumii."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 27;
update public.questions set note_i18n = '{"fr": "Quatre vases canopes, un par organe, chacun avec une tête de gardien différente.", "es": "Cuatro vasos canopos, uno por órgano, cada uno con una cabeza guardiana distinta.", "ro": "Patru vase canope, unul de fiecare organ, fiecare cu alt cap de paznic."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 28;
update public.questions set note_i18n = '{"fr": "L’Égypte a environ 900 km de côte méditerranéenne, avec Alexandrie pour grand port.", "es": "Egipto tiene unos 900 km de costa mediterránea, con Alejandría como gran puerto.", "ro": "Egiptul are vreo 900 km de coastă mediteraneană, cu Alexandria drept mare port."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 29;
update public.questions set note_i18n = '{"fr": "La mer Rouge sépare l’Égypte de l’Arabie et ouvre sur l’océan Indien.", "es": "El mar Rojo separa Egipto de Arabia y da al océano Índico.", "ro": "Marea Roșie desparte Egiptul de Arabia și dă spre Oceanul Indian."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 30;
update public.questions set note_i18n = '{"fr": "Le Sinaï est le seul pont terrestre entre l’Afrique et l’Asie, et porte le plus haut sommet d’Égypte.", "es": "El Sinaí es el único puente terrestre entre África y Asia, y tiene la cima más alta de Egipto.", "ro": "Sinai e singura punte de uscat între Africa și Asia și are cel mai înalt vârf din Egipt."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 31;
update public.questions set note_i18n = '{"fr": "La frontière libyenne est une ligne droite dans le désert, longue de plus de 1 100 km.", "es": "La frontera con Libia es una línea recta en el desierto de más de 1.100 km.", "ro": "Granița cu Libia e o linie dreaptă în deșert, de peste 1.100 km."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 32;
update public.questions set note_i18n = '{"fr": "Le Soudan et l’Égypte n’ont fait qu’un pays jusqu’en 1956 — et le Nil entre par là.", "es": "Sudán y Egipto fueron un solo país hasta 1956, y el Nilo entra por ahí.", "ro": "Sudanul și Egiptul au fost o singură țară până în 1956 — și Nilul intră pe acolo."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 33;
update public.questions set note_i18n = '{"fr": "Le delta du Nil est parmi les terres les plus fertiles du monde — et il a la forme de la lettre grecque.", "es": "El delta del Nilo es de las tierras más fértiles del mundo, y tiene la forma de la letra griega.", "ro": "Delta Nilului e printre cele mai fertile pământuri, și are forma literei grecești."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 34;
update public.questions set note_i18n = '{"fr": "Environ 95 % des Égyptiens vivent à quelques kilomètres du Nil.", "es": "Cerca del 95% de los egipcios viven a pocos kilómetros del Nilo.", "ro": "Circa 95% dintre egipteni trăiesc la câțiva kilometri de Nil."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 35;
update public.questions set note_i18n = '{"fr": "Se dit quand un parent vante son enfant : l’amour ne voit pas les défauts.", "es": "Se dice cuando un padre presume de su hijo: el cariño no ve los defectos.", "ro": "Se spune când un părinte își laudă copilul: dragostea nu vede cusururile."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 36;
update public.questions set note_i18n = '{"fr": "Se dit pour empêcher quelqu’un de ressasser ce qui est déjà fait.", "es": "Se dice para que alguien deje de darle vueltas a lo ya hecho.", "ro": "Se spune ca cineva să nu mai rumege ce s-a întâmplat deja."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 37;
update public.questions set note_i18n = '{"fr": "Se dit du travail à plusieurs : seul, on n’arrive à rien.", "es": "Se dice del trabajo en equipo: solo no se llega a nada.", "ro": "Se spune despre munca în echipă: singur nu ajungi nicăieri."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 38;
update public.questions set note_i18n = '{"fr": "Se dit dans la difficulté : la sortie arrive à qui sait attendre.", "es": "Se dice en los apuros: la salida llega a quien sabe esperar.", "ro": "Se spune la greu: ieșirea vine la cine știe să aștepte."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 39;
update public.questions set note_i18n = '{"fr": "Se dit de quelqu’un qui ne parle que de ce qui lui manque.", "es": "Se dice de quien no para de hablar de lo que le falta.", "ro": "Se spune despre cine vorbește întruna despre ce-i lipsește."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 40;
update public.questions set note_i18n = '{"fr": "Vieux conseil : coupe la cause au lieu d’en porter les conséquences éternellement.", "es": "Consejo viejo: corta la causa en vez de cargar siempre con las consecuencias.", "ro": "Sfat vechi: taie cauza, în loc să duci veșnic consecințele."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 41;
update public.questions set note_i18n = '{"fr": "En Égypte, c’est l’entremetteur qu’on blâme si le mariage tourne mal.", "es": "En Egipto, al casamentero se le culpa si el matrimonio sale mal.", "ro": "În Egipt, pețitorul e cel învinovățit dacă iese prost căsnicia."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 42;
update public.questions set note_i18n = '{"fr": "Un seul mot pour l’excuse, le réconfort et la compassion — le ton tranche.", "es": "Una sola palabra para disculpa, consuelo y ánimo: el tono decide cuál.", "ro": "Un singur cuvânt pentru scuză, alinare și încurajare — tonul decide."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 43;
update public.questions set note_i18n = '{"fr": "Le temps est élastique ; l’intention est vraie même si l’heure ne l’est pas.", "es": "El tiempo es elástico; la intención es real aunque la hora no lo sea.", "ro": "Timpul e elastic; intenția e reală chiar dacă ora nu e."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 44;
update public.questions set note_i18n = '{"fr": "Refuser une ou deux fois fait partie du rituel : l’hôte insiste, l’invité cède.", "es": "Rechazar una o dos veces es parte del rito: el anfitrión insiste, el invitado cede.", "ro": "Refuzul de una-două ori face parte din ritual: gazda insistă, oaspetele cedează."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 45;
update public.questions set note_i18n = '{"fr": "Mazbout, ziyada, ala er-reeha : trois niveaux de sucre qui ont chacun un nom.", "es": "Mazbout, ziyada y “ala er-reeha”: tres niveles de azúcar con nombre propio.", "ro": "Mazbout, ziyada și „ala er-reeha”: trei niveluri de zahăr, fiecare cu numele lui."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 46;
update public.questions set note_i18n = '{"fr": "Ces titres sont de la politesse, pas des métiers — le bacha peut être votre chauffeur.", "es": "Esos títulos son cortesía, no oficios: el bacha puede ser tu conductor.", "ro": "Titlurile sunt politețe, nu meserii — pașa poate fi șoferul tău."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 47;
update public.questions set note_i18n = '{"fr": "Les mains parlent en Égypte, et celle-ci veut dire : une seconde.", "es": "Las manos hablan en Egipto, y esta dice: un segundo.", "ro": "Mâinile vorbesc în Egipt, iar asta zice: o secundă."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 48;
update public.questions set note_i18n = '{"fr": "On le dit dans la joie comme dans la peine ; la vraie réponse vient après.", "es": "Se dice en la alegría y en el apuro; la respuesta de verdad viene después.", "ro": "Se spune și la bine, și la greu; răspunsul adevărat vine după."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 49;
update public.questions set note_i18n = '{"fr": "Pas seulement aux mariages : aussi pour un examen réussi ou un retour sain et sauf.", "es": "No solo en bodas: también por un examen aprobado o una vuelta a salvo.", "ro": "Nu doar la nunți: și pentru un examen luat sau o întoarcere cu bine."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 50;
update public.questions set note_i18n = '{"fr": "Littéralement « que tes mains soient saines » — le plus beau merci pour un travail fait à la main.", "es": "Literalmente “que tus manos estén a salvo”: el mayor agradecimiento por algo hecho a mano.", "ro": "Literal „să-ți fie mâinile sănătoase” — cea mai mare mulțumire pentru ce e făcut de mână."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 51;
update public.questions set note_i18n = '{"fr": "Le marchandage fait partie de l’échange, et personne ne s’en offusque — avec le sourire.", "es": "El regateo es parte del trato, y a nadie le molesta: con una sonrisa.", "ro": "Negocierea face parte din schimb și nu supără pe nimeni — cu zâmbetul pe buze."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 52;

notify pgrst, 'reload schema';
