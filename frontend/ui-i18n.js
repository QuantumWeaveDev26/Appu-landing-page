/**
 * AppuI18n: translates every app UI string (text, placeholders, aria-labels, titles) into
 * Hindi or Kannada, including UI that is rendered later (panels, modals, badges).
 * Chat messages and lesson content are left alone: Appu writes those in the chosen language.
 * Numbers inside a string are kept: "3 Days" uses the key "{n} Days".
 * Generated from the app's English strings; add new UI text to DICT as [hindi, kannada].
 */
(function (root) {
  'use strict';

  const DICT = {
"A personal learning roadmap": [
"एक निजी सीखने का रोडमैप",
"ವೈಯಕ್ತಿಕ ಕಲಿಕೆಯ ಮಾರ್ಗಸೂಚಿ"
],
"A {n}-digit code has been sent to your parent's WhatsApp!": [
"{n}-अंकों का कोड अभिभावक के WhatsApp पर भेज दिया गया है!",
"{n}-ಅಂಕಿಯ ಕೋಡ್ ಪೋಷಕರ WhatsApp ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ!"
],
"AI and coding skills": [
"AI और कोडिंग कौशल",
"AI ಮತ್ತು ಕೋಡಿಂಗ್ ಕೌಶಲ್ಯಗಳು"
],
"AI learning companion": [
"AI सीखने का साथी",
"AI ಕಲಿಕೆಯ ಸಂಗಾತಿ"
],
"APPU AI Companion": [
"APPU AI साथी",
"APPU AI ಸಂಗಾತಿ"
],
"APPU AI home": [
"APPU AI होम",
"APPU AI ಮುಖಪುಟ"
],
"Academy": [
"अकादमी",
"ಅಕಾಡೆಮಿ"
],
"Account": [
"खाता",
"ಖಾತೆ"
],
"Active Learning": [
"सक्रिय पढ़ाई",
"ಸಕ್ರಿಯ ಕಲಿಕೆ"
],
"Add New Learner Profile:": [
"नई शिक्षार्थी प्रोफ़ाइल जोड़ें:",
"ಹೊಸ ಕಲಿಕಾರ್ಥಿ ಪ್ರೊಫೈಲ್ ಸೇರಿಸಿ:"
],
"Add Parent WhatsApp Number": [
"अभिभावक का WhatsApp नंबर जोड़ें",
"ಪೋಷಕರ WhatsApp ಸಂಖ್ಯೆ ಸೇರಿಸಿ"
],
"Add a photo or notes": [
"फ़ोटो या नोट्स जोड़ें",
"ಫೋಟೋ ಅಥವಾ ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ"
],
"Add the number you use on WhatsApp so Appu recognises your child when you message there — no setting up again. We use it only for your child’s learning, never share it, and you can opt out anytime.": [
"वह नंबर जोड़ें जो आप WhatsApp पर इस्तेमाल करते हैं, ताकि वहाँ संदेश भेजने पर Appu आपके बच्चे को पहचान ले — दोबारा सेटअप की ज़रूरत नहीं। हम इसे सिर्फ़ आपके बच्चे की पढ़ाई के लिए इस्तेमाल करते हैं, कभी साझा नहीं करते, और आप कभी भी बाहर निकल सकते हैं।",
"ನೀವು WhatsApp ನಲ್ಲಿ ಬಳಸುವ ಸಂಖ್ಯೆಯನ್ನು ಸೇರಿಸಿ, ಅಲ್ಲಿ ಸಂದೇಶ ಕಳುಹಿಸಿದಾಗ Appu ನಿಮ್ಮ ಮಗುವನ್ನು ಗುರುತಿಸುತ್ತದೆ — ಮತ್ತೆ ಸೆಟಪ್ ಬೇಕಿಲ್ಲ. ನಾವು ಇದನ್ನು ನಿಮ್ಮ ಮಗುವಿನ ಕಲಿಕೆಗೆ ಮಾತ್ರ ಬಳಸುತ್ತೇವೆ, ಎಂದಿಗೂ ಹಂಚಿಕೊಳ್ಳುವುದಿಲ್ಲ, ಮತ್ತು ನೀವು ಯಾವಾಗ ಬೇಕಾದರೂ ಹೊರಗುಳಿಯಬಹುದು."
],
"Adjust how answers sound and how the page responds.": [
"जवाब कैसे सुनाई दें और पेज कैसे प्रतिक्रिया दे, यह बदलें।",
"ಉತ್ತರಗಳು ಹೇಗೆ ಕೇಳಿಸುತ್ತವೆ ಮತ್ತು ಪುಟ ಹೇಗೆ ಸ್ಪಂದಿಸುತ್ತದೆ ಎಂದು ಹೊಂದಿಸಿ."
],
"Advanced Preferences": [
"उन्नत पसंद",
"ಸುಧಾರಿತ ಆದ್ಯತೆಗಳು"
],
"All": [
"सभी",
"ಎಲ್ಲಾ"
],
"Answer {n} quiz questions correctly to unlock": [
"अनलॉक करने के लिए {n} क्विज़ प्रश्नों के सही जवाब दें",
"ಅನ್‌ಲಾಕ್ ಮಾಡಲು {n} ಕ್ವಿಜ್ ಪ್ರಶ್ನೆಗಳಿಗೆ ಸರಿಯಾಗಿ ಉತ್ತರಿಸಿ"
],
"Answers, concept maps, and quizzes will be strictly grounded in this material.": [
"जवाब, अवधारणा मैप और क्विज़ पूरी तरह इसी सामग्री पर आधारित होंगे।",
"ಉತ್ತರಗಳು, ಪರಿಕಲ್ಪನೆ ನಕ್ಷೆಗಳು ಮತ್ತು ಕ್ವಿಜ್‌ಗಳು ಸಂಪೂರ್ಣವಾಗಿ ಈ ವಿಷಯವನ್ನೇ ಆಧರಿಸಿರುತ್ತವೆ."
],
"Appu Lesson": [
"Appu पाठ",
"Appu ಪಾಠ"
],
"Appu is ready": [
"Appu तैयार है",
"Appu ಸಿದ್ಧವಾಗಿದೆ"
],
"Appu is speaking": [
"Appu बोल रहा है",
"Appu ಮಾತನಾಡುತ್ತಿದೆ"
],
"Appu is thinking": [
"Appu सोच रहा है",
"Appu ಯೋಚಿಸುತ್ತಿದೆ"
],
"Appu says": [
"Appu कहता है",
"Appu ಹೇಳುತ್ತದೆ"
],
"Appu speaks when audio is available.": [
"ऑडियो उपलब्ध होने पर Appu बोलता है।",
"ಆಡಿಯೋ ಲಭ್ಯವಿದ್ದಾಗ Appu ಮಾತನಾಡುತ್ತದೆ."
],
"Appu's response": [
"Appu का जवाब",
"Appu ಉತ್ತರ"
],
"Ask Appu": [
"Appu से पूछें",
"Appu ಗೆ ಕೇಳಿ"
],
"Ask Appu a Topic": [
"Appu से कोई विषय पूछें",
"Appu ಗೆ ಒಂದು ವಿಷಯ ಕೇಳಿ"
],
"Ask Appu anything": [
"Appu से कुछ भी पूछें",
"Appu ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಿ"
],
"Ask Appu anything from Class {n} to {n}.": [
"कक्षा {n} से {n} तक कुछ भी Appu से पूछें।",
"{n} ರಿಂದ {n}ನೇ ತರಗತಿವರೆಗೆ Appu ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಿ."
],
"Ask Appu anything…": [
"Appu से कुछ भी पूछें…",
"Appu ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಿ…"
],
"Ask Appu to introduce himself": [
"Appu से अपना परिचय देने को कहें",
"ತನ್ನನ್ನು ಪರಿಚಯಿಸಲು Appu ಗೆ ಕೇಳಿ"
],
"Ask Appu your first question to unlock": [
"अनलॉक करने के लिए Appu से अपना पहला प्रश्न पूछें",
"ಅನ್‌ಲಾಕ್ ಮಾಡಲು Appu ಗೆ ಮೊದಲ ಪ್ರಶ್ನೆ ಕೇಳಿ"
],
"Ask Appu {n} questions to unlock": [
"अनलॉक करने के लिए Appu से {n} प्रश्न पूछें",
"ಅನ್‌ಲಾಕ್ ಮಾಡಲು Appu ಗೆ {n} ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ"
],
"Ask about science, maths, homework…": [
"विज्ञान, गणित, होमवर्क के बारे में पूछें…",
"ವಿಜ್ಞಾನ, ಗಣಿತ, ಹೋಮ್‌ವರ್ಕ್ ಬಗ್ಗೆ ಕೇಳಿ…"
],
"Ask anything from your school books. I explain it simply, step by step.": [
"अपनी स्कूल की किताबों से कुछ भी पूछें। मैं इसे आसान तरीके से, कदम-दर-कदम समझाता हूँ।",
"ನಿಮ್ಮ ಶಾಲಾ ಪುಸ್ತಕಗಳಿಂದ ಏನನ್ನಾದರೂ ಕೇಳಿ. ನಾನು ಅದನ್ನು ಸರಳವಾಗಿ, ಹಂತ ಹಂತವಾಗಿ ವಿವರಿಸುತ್ತೇನೆ."
],
"Ask using your voice": [
"अपनी आवाज़ से पूछें",
"ನಿಮ್ಮ ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ"
],
"Ask, explore, understand": [
"पूछें, खोजें, समझें",
"ಕೇಳಿ, ಅನ್ವೇಷಿಸಿ, ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ"
],
"Attach a photo of your homework": [
"अपने होमवर्क की फ़ोटो लगाएँ",
"ನಿಮ್ಮ ಹೋಮ್‌ವರ್ಕ್ ಫೋಟೋ ಲಗತ್ತಿಸಿ"
],
"Auditory (spoken explanations)": [
"श्रव्य (बोलकर व्याख्या)",
"ಶ್ರವಣ (ಮಾತಿನ ವಿವರಣೆಗಳು)"
],
"Back to Home": [
"होम पर वापस",
"ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ"
],
"Back to Home Landing": [
"होम पेज पर वापस",
"ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ"
],
"Badges Earned": [
"मिले हुए बैज",
"ಗಳಿಸಿದ ಬ್ಯಾಡ್ಜ್‌ಗಳು"
],
"Balanced & Clear": [
"संतुलित और स्पष्ट",
"ಸಮತೋಲಿತ ಮತ್ತು ಸ್ಪಷ್ಟ"
],
"Basic Profile": [
"मूल प्रोफ़ाइल",
"ಮೂಲ ಪ್ರೊಫೈಲ್"
],
"Book parent call": [
"अभिभावक कॉल बुक करें",
"ಪೋಷಕರ ಕರೆ ಬುಕ್ ಮಾಡಿ"
],
"Boy": [
"लड़का",
"ಹುಡುಗ"
],
"Break / Away": [
"ब्रेक / दूर",
"ವಿರಾಮ / ದೂರ"
],
"Browse File": [
"फ़ाइल चुनें",
"ಫೈಲ್ ಆರಿಸಿ"
],
"By continuing, you agree to our": [
"जारी रखकर, आप हमारी",
"ಮುಂದುವರಿಸುವ ಮೂಲಕ, ನೀವು ನಮ್ಮ"
],
"Cancel": [
"रद्द करें",
"ರದ್ದುಮಾಡಿ"
],
"Cancellation & Refunds": [
"रद्दीकरण और रिफ़ंड",
"ರದ್ದತಿ ಮತ್ತು ಮರುಪಾವತಿ"
],
"Chat with Appu": [
"Appu से चैट करें",
"Appu ಜೊತೆ ಚಾಟ್ ಮಾಡಿ"
],
"Checking your reports…": [
"आपकी रिपोर्ट देखी जा रही हैं…",
"ನಿಮ್ಮ ವರದಿಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…"
],
"Child Performance Report": [
"बच्चे की प्रदर्शन रिपोर्ट",
"ಮಗುವಿನ ಸಾಧನೆ ವರದಿ"
],
"Child Progress Report": [
"बच्चे की प्रगति रिपोर्ट",
"ಮಗುವಿನ ಪ್ರಗತಿ ವರದಿ"
],
"Choose a learning mission": [
"सीखने का मिशन चुनें",
"ಕಲಿಕೆಯ ಮಿಷನ್ ಆರಿಸಿ"
],
"Choose language": [
"भाषा चुनें",
"ಭಾಷೆ ಆರಿಸಿ"
],
"Choose one…": [
"एक चुनें…",
"ಒಂದನ್ನು ಆರಿಸಿ…"
],
"Choose what you like most…": [
"जो सबसे अच्छा लगे वह चुनें…",
"ನಿಮಗೆ ಹೆಚ್ಚು ಇಷ್ಟವಾದುದನ್ನು ಆರಿಸಿ…"
],
"Class / Grade Band": [
"कक्षा",
"ತರಗತಿ"
],
"Class {n}": [
"कक्षा {n}",
"ತರಗತಿ {n}"
],
"Class {n}–{n} · Free to try, no sign-up": [
"कक्षा {n}–{n} · मुफ़्त आज़माएँ, साइन-अप ज़रूरी नहीं",
"ತರಗತಿ {n}–{n} · ಉಚಿತವಾಗಿ ಪ್ರಯತ್ನಿಸಿ, ಸೈನ್-ಅಪ್ ಬೇಕಿಲ್ಲ"
],
"Clean Minimal": [
"साफ़ और सरल",
"ಸ್ವಚ್ಛ ಸರಳ"
],
"Clear active document and return to standard mode": [
"दस्तावेज़ हटाएँ और सामान्य मोड पर लौटें",
"ದಾಖಲೆ ತೆಗೆದು ಸಾಮಾನ್ಯ ಮೋಡ್‌ಗೆ ಹಿಂತಿರುಗಿ"
],
"Clear all history": [
"पूरा इतिहास मिटाएँ",
"ಎಲ್ಲ ಇತಿಹಾಸ ಅಳಿಸಿ"
],
"Clear chat": [
"चैट साफ़ करें",
"ಚಾಟ್ ಅಳಿಸಿ"
],
"Clear document": [
"दस्तावेज़ हटाएँ",
"ದಾಖಲೆ ತೆಗೆದುಹಾಕಿ"
],
"Click below to send a {n}-digit unlock code and learning summary to your parent's registered WhatsApp.": [
"अभिभावक के WhatsApp पर {n}-अंकों का अनलॉक कोड और पढ़ाई का सारांश भेजने के लिए नीचे क्लिक करें।",
"ಪೋಷಕರ WhatsApp ಗೆ {n}-ಅಂಕಿಯ ಅನ್‌ಲಾಕ್ ಕೋಡ್ ಮತ್ತು ಕಲಿಕೆಯ ಸಾರಾಂಶ ಕಳುಹಿಸಲು ಕೆಳಗೆ ಕ್ಲಿಕ್ ಮಾಡಿ."
],
"Close": [
"बंद करें",
"ಮುಚ್ಚಿ"
],
"Close Parent Zone": [
"अभिभावक क्षेत्र बंद करें",
"ಪೋಷಕರ ವಲಯ ಮುಚ್ಚಿ"
],
"Close Quest Modal": [
"खोज विंडो बंद करें",
"ಅನ್ವೇಷಣೆ ವಿಂಡೋ ಮುಚ್ಚಿ"
],
"Close chat": [
"चैट बंद करें",
"ಚಾಟ್ ಮುಚ್ಚಿ"
],
"Close dialog": [
"डायलॉग बंद करें",
"ಸಂವಾದ ಮುಚ್ಚಿ"
],
"Close menu": [
"मेनू बंद करें",
"ಮೆನು ಮುಚ್ಚಿ"
],
"Close parent setup": [
"अभिभावक सेटअप बंद करें",
"ಪೋಷಕರ ಸೆಟಪ್ ಮುಚ್ಚಿ"
],
"Close prompt library": [
"प्रॉम्प्ट लाइब्रेरी बंद करें",
"ಪ್ರಾಂಪ್ಟ್ ಲೈಬ್ರರಿ ಮುಚ್ಚಿ"
],
"Close recent chats": [
"हाल की चैट बंद करें",
"ಇತ್ತೀಚಿನ ಚಾಟ್‌ಗಳನ್ನು ಮುಚ್ಚಿ"
],
"Close reports": [
"रिपोर्ट बंद करें",
"ವರದಿ ಮುಚ್ಚಿ"
],
"Close saved lessons": [
"सहेजे गए पाठ बंद करें",
"ಉಳಿಸಿದ ಪಾಠಗಳನ್ನು ಮುಚ್ಚಿ"
],
"Close upload dialog": [
"अपलोड डायलॉग बंद करें",
"ಅಪ್‌ಲೋಡ್ ಸಂವಾದ ಮುಚ್ಚಿ"
],
"Close voice settings": [
"आवाज़ सेटिंग्स बंद करें",
"ಧ್ವನಿ ಸೆಟ್ಟಿಂಗ್ ಮುಚ್ಚಿ"
],
"Connect your WhatsApp": [
"अपना WhatsApp कनेक्ट करें",
"ನಿಮ್ಮ WhatsApp ಸಂಪರ್ಕಿಸಿ"
],
"Contact Us": [
"संपर्क करें",
"ಸಂಪರ್ಕಿಸಿ"
],
"Continue with Google": [
"Google के साथ जारी रखें",
"Google ಮೂಲಕ ಮುಂದುವರಿಸಿ"
],
"Conversation with Appu": [
"Appu के साथ बातचीत",
"Appu ಜೊತೆ ಸಂಭಾಷಣೆ"
],
"Could not load recent chats. Try again.": [
"हाल की चैट लोड नहीं हो सकीं। फिर कोशिश करें।",
"ಇತ್ತೀಚಿನ ಚಾಟ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
],
"Create Account": [
"खाता बनाएँ",
"ಖಾತೆ ರಚಿಸಿ"
],
"Create free account": [
"मुफ़्त खाता बनाएँ",
"ಉಚಿತ ಖಾತೆ ರಚಿಸಿ"
],
"Curated study questions & prompts": [
"चुने हुए पढ़ाई के प्रश्न और प्रॉम्प्ट",
"ಆಯ್ದ ಅಧ್ಯಯನ ಪ್ರಶ್ನೆಗಳು ಮತ್ತು ಪ್ರಾಂಪ್ಟ್‌ಗಳು"
],
"Curiosity Beyond Syllabus 🌟": [
"पाठ्यक्रम से आगे जिज्ञासा 🌟",
"ಪಠ್ಯಕ್ರಮ ಮೀರಿದ ಕುತೂಹಲ 🌟"
],
"Curious Mind": [
"जिज्ञासु मन",
"ಕುತೂಹಲಿ ಮನಸ್ಸು"
],
"Daily Streak": [
"रोज़ की स्ट्रीक",
"ದೈನಂದಿನ ಸ್ಟ್ರೀಕ್"
],
"Dark Mode": [
"डार्क मोड",
"ಡಾರ್ಕ್ ಮೋಡ್"
],
"Dark theme": [
"डार्क थीम",
"ಡಾರ್ಕ್ ಥೀಮ್"
],
"Date of Birth": [
"जन्मतिथि",
"ಜನ್ಮ ದಿನಾಂಕ"
],
"Diagram": [
"चित्र",
"ರೇಖಾಚಿತ್ರ"
],
"Diagram Detective": [
"चित्र जासूस",
"ರೇಖಾಚಿತ್ರ ಪತ್ತೇದಾರ"
],
"Dismiss response": [
"जवाब बंद करें",
"ಉತ್ತರ ಮುಚ್ಚಿ"
],
"Download performance report (PDF)": [
"प्रदर्शन रिपोर्ट डाउनलोड करें (PDF)",
"ಸಾಧನೆ ವರದಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ (PDF)"
],
"Drag and drop PDF or text file here, or browse": [
"PDF या टेक्स्ट फ़ाइल यहाँ खींचकर छोड़ें, या चुनें",
"PDF ಅಥವಾ ಪಠ್ಯ ಫೈಲ್ ಇಲ್ಲಿ ಎಳೆದು ಬಿಡಿ ಅಥವಾ ಆರಿಸಿ"
],
"Drop your PDF or textbook chapter here": [
"अपनी PDF या अध्याय फ़ाइल यहाँ छोड़ें",
"ನಿಮ್ಮ PDF ಅಥವಾ ಅಧ್ಯಾಯ ಇಲ್ಲಿ ಬಿಡಿ"
],
"Email for the meeting": [
"मीटिंग के लिए ईमेल",
"ಸಭೆಗಾಗಿ ಇಮೇಲ್"
],
"End call": [
"कॉल समाप्त करें",
"ಕರೆ ಕೊನೆಗೊಳಿಸಿ"
],
"English": [
"अंग्रेज़ी",
"ಇಂಗ್ಲಿಷ್"
],
"Enter {n}-Digit Parent Code": [
"{n}-अंकों का अभिभावक कोड डालें",
"{n}-ಅಂಕಿಯ ಪೋಷಕರ ಕೋಡ್ ನಮೂದಿಸಿ"
],
"Exam Drills": [
"परीक्षा अभ्यास",
"ಪರೀಕ್ಷಾ ಅಭ್ಯಾಸ"
],
"Exam Practice": [
"परीक्षा अभ्यास",
"ಪರೀಕ್ಷಾ ಅಭ್ಯಾಸ"
],
"Exam preparation": [
"परीक्षा की तैयारी",
"ಪರೀಕ್ಷಾ ತಯಾರಿ"
],
"Expand": [
"बड़ा करें",
"ವಿಸ್ತರಿಸಿ"
],
"Expand in chat drawer": [
"चैट में बड़ा करें",
"ಚಾಟ್‌ನಲ್ಲಿ ವಿಸ್ತರಿಸಿ"
],
"Explain My Topic": [
"मेरा विषय समझाओ",
"ನನ್ನ ವಿಷಯ ವಿವರಿಸಿ"
],
"Explain Pythagoras theorem": [
"पाइथागोरस प्रमेय समझाइए",
"ಪೈಥಾಗರಸ್ ಪ್ರಮೇಯ ವಿವರಿಸಿ"
],
"Explains it your way": [
"आपके तरीके से समझाता है",
"ನಿಮ್ಮ ರೀತಿಯಲ್ಲಿ ವಿವರಿಸುತ್ತದೆ"
],
"Explanations are clear and easy to understand": [
"व्याख्याएँ साफ़ और समझने में आसान हैं",
"ವಿವರಣೆಗಳು ಸ್ಪಷ್ಟ ಮತ್ತು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸುಲಭ"
],
"Explore Prompts": [
"प्रॉम्प्ट खोजें",
"ಪ್ರಾಂಪ್ಟ್‌ಗಳನ್ನು ಅನ್ವೇಷಿಸಿ"
],
"Explorer": [
"खोजकर्ता",
"ಅನ್ವೇಷಕ"
],
"Extracting text...": [
"टेक्स्ट निकाला जा रहा है...",
"ಪಠ್ಯ ಹೊರತೆಗೆಯಲಾಗುತ್ತಿದೆ..."
],
"Favorite Interests & Hobbies (comma-separated)": [
"पसंदीदा रुचियाँ और शौक (कॉमा से अलग करें)",
"ಮೆಚ್ಚಿನ ಆಸಕ್ತಿಗಳು ಮತ್ತು ಹವ್ಯಾಸಗಳು (ಅಲ್ಪವಿರಾಮದಿಂದ ಪ್ರತ್ಯೇಕಿಸಿ)"
],
"Favorite Subjects": [
"पसंदीदा विषय",
"ಮೆಚ್ಚಿನ ವಿಷಯಗಳು"
],
"Five fun questions, one at a time": [
"पाँच मज़ेदार प्रश्न, एक-एक करके",
"ಐದು ಮೋಜಿನ ಪ್ರಶ್ನೆಗಳು, ಒಂದೊಂದಾಗಿ"
],
"Flashcard Pro": [
"फ़्लैशकार्ड प्रो",
"ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್ ಪ್ರೊ"
],
"Flashcards": [
"फ़्लैशकार्ड",
"ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್‌ಗಳು"
],
"Focused & Direct": [
"केंद्रित और सीधा",
"ಕೇಂದ್ರೀಕೃತ ಮತ್ತು ನೇರ"
],
"For a parent/guardian: choose a convenient time to speak with an IGR Academy mentor about your learner.": [
"अभिभावक के लिए: अपने बच्चे के बारे में IGR Academy मेंटर से बात करने का सुविधाजनक समय चुनें।",
"ಪೋಷಕರಿಗಾಗಿ: ನಿಮ್ಮ ಮಗುವಿನ ಬಗ್ಗೆ IGR Academy ಮಾರ್ಗದರ್ಶಕರೊಂದಿಗೆ ಮಾತನಾಡಲು ಅನುಕೂಲಕರ ಸಮಯ ಆರಿಸಿ."
],
"Friendly Rounded": [
"दोस्ताना गोल",
"ಸ್ನೇಹಪರ ದುಂಡು"
],
"Friendly Standard": [
"दोस्ताना सामान्य",
"ಸ್ನೇಹಪರ ಸಾಮಾನ್ಯ"
],
"From the makers of Appu": [
"Appu बनाने वालों की ओर से",
"Appu ತಯಾರಕರಿಂದ"
],
"Gender": [
"लिंग",
"ಲಿಂಗ"
],
"Gentle feedback for taps and actions.": [
"टैप और क्रियाओं के लिए हल्की प्रतिक्रिया।",
"ಟ್ಯಾಪ್ ಮತ್ತು ಕ್ರಿಯೆಗಳಿಗೆ ಮೃದು ಪ್ರತಿಕ್ರಿಯೆ."
],
"Get hints and learn each step": [
"संकेत पाएँ और हर कदम सीखें",
"ಸುಳಿವು ಪಡೆಯಿರಿ, ಪ್ರತಿ ಹಂತ ಕಲಿಯಿರಿ"
],
"Getting ready…": [
"तैयार हो रहा है…",
"ಸಿದ್ಧವಾಗುತ್ತಿದೆ…"
],
"Girl": [
"लड़की",
"ಹುಡುಗಿ"
],
"Grade {n}": [
"कक्षा {n}",
"ತರಗತಿ {n}"
],
"Grounded Chapter Tutor": [
"अध्याय आधारित ट्यूटर",
"ಅಧ್ಯಾಯ ಆಧಾರಿತ ಬೋಧಕ"
],
"Guide": [
"गाइड",
"ಮಾರ್ಗದರ್ಶಿ"
],
"Home": [
"होम",
"ಮುಖಪುಟ"
],
"Home (Landing Page)": [
"होम (लैंडिंग पेज)",
"ಮುಖಪುಟ (ಲ್ಯಾಂಡಿಂಗ್ ಪುಟ)"
],
"Homework Helper": [
"होमवर्क सहायक",
"ಹೋಮ್‌ವರ್ಕ್ ಸಹಾಯಕ"
],
"Homework Hints": [
"होमवर्क संकेत",
"ಹೋಮ್‌ವರ್ಕ್ ಸುಳಿವುಗಳು"
],
"Homework and concept support": [
"होमवर्क और अवधारणा में मदद",
"ಹೋಮ್‌ವರ್ಕ್ ಮತ್ತು ಪರಿಕಲ್ಪನೆ ಬೆಂಬಲ"
],
"Homework and exam help are genuinely useful": [
"होमवर्क और परीक्षा में मदद सच में उपयोगी है",
"ಹೋಮ್‌ವರ್ಕ್ ಮತ್ತು ಪರೀಕ್ಷಾ ಸಹಾಯ ನಿಜವಾಗಿಯೂ ಉಪಯುಕ್ತ"
],
"Honestly, it's great as it is!": [
"सच कहूँ तो, यह जैसा है वैसा ही बढ़िया है!",
"ನಿಜ ಹೇಳಬೇಕೆಂದರೆ, ಇದು ಈಗಿರುವಂತೆಯೇ ಅದ್ಭುತ!"
],
"Household / Family Name": [
"परिवार का नाम",
"ಕುಟುಂಬದ ಹೆಸರು"
],
"How does photosynthesis work?": [
"प्रकाश संश्लेषण कैसे होता है?",
"ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಹೇಗೆ ನಡೆಯುತ್ತದೆ?"
],
"How is Appu working for your family?": [
"Appu आपके परिवार के लिए कैसा काम कर रहा है?",
"Appu ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ಹೇಗೆ ಉಪಯುಕ್ತವಾಗಿದೆ?"
],
"I confirm I am the parent or guardian and {n} years or older, creating this account for my child.": [
"मैं पुष्टि करता/करती हूँ कि मैं अभिभावक हूँ, {n} वर्ष या उससे अधिक का/की हूँ, और यह खाता अपने बच्चे के लिए बना रहा/रही हूँ।",
"ನಾನು ಪೋಷಕ/ಪಾಲಕನಾಗಿದ್ದೇನೆ, {n} ವರ್ಷ ಅಥವಾ ಹೆಚ್ಚಿನವನಾಗಿದ್ದೇನೆ ಮತ್ತು ನನ್ನ ಮಗುವಿಗಾಗಿ ಈ ಖಾತೆ ರಚಿಸುತ್ತಿದ್ದೇನೆ ಎಂದು ದೃಢೀಕರಿಸುತ್ತೇನೆ."
],
"IGR Academy home": [
"IGR Academy होम",
"IGR Academy ಮುಖಪುಟ"
],
"IGr is a hyper-personalised learning system for CBSE students. It adapts to each child's pace and way of understanding, with Appu as their guide.": [
"IGr, CBSE छात्रों के लिए एक अति-व्यक्तिगत सीखने की प्रणाली है। यह हर बच्चे की गति और समझने के तरीके के अनुसार ढलती है, और Appu उनका मार्गदर्शक है।",
"IGr CBSE ವಿದ್ಯಾರ್ಥಿಗಳಿಗಾಗಿ ಅತಿ-ವೈಯಕ್ತೀಕೃತ ಕಲಿಕಾ ವ್ಯವಸ್ಥೆ. ಇದು ಪ್ರತಿ ಮಗುವಿನ ವೇಗ ಮತ್ತು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವ ರೀತಿಗೆ ಹೊಂದಿಕೊಳ್ಳುತ್ತದೆ, Appu ಅವರ ಮಾರ್ಗದರ್ಶಿ."
],
"Interactive (conversations & questions)": [
"संवादात्मक (बातचीत और प्रश्न)",
"ಸಂವಾದಾತ್ಮಕ (ಸಂಭಾಷಣೆ ಮತ್ತು ಪ್ರಶ್ನೆಗಳು)"
],
"It keeps my child engaged and curious": [
"यह मेरे बच्चे को जोड़े और जिज्ञासु रखता है",
"ಇದು ನನ್ನ ಮಗುವನ್ನು ತೊಡಗಿಸಿ ಕುತೂಹಲದಿಂದ ಇರಿಸುತ್ತದೆ"
],
"Join the APPU Beta — Free": [
"APPU बीटा से जुड़ें — मुफ़्त",
"APPU ಬೀಟಾಗೆ ಸೇರಿ — ಉಚಿತ"
],
"Launch Appu Now": [
"अभी Appu शुरू करें",
"ಈಗ Appu ಪ್ರಾರಂಭಿಸಿ"
],
"Learn from Your Notes or Textbook": [
"अपने नोट्स या पाठ्यपुस्तक से सीखें",
"ನಿಮ್ಮ ಟಿಪ್ಪಣಿ ಅಥವಾ ಪಠ್ಯಪುಸ್ತಕದಿಂದ ಕಲಿಯಿರಿ"
],
"Learn with Appu": [
"Appu के साथ सीखें",
"Appu ಜೊತೆ ಕಲಿಯಿರಿ"
],
"Learn {n} days in a row to unlock": [
"अनलॉक करने के लिए लगातार {n} दिन पढ़ें",
"ಅನ್‌ಲಾಕ್ ಮಾಡಲು ಸತತ {n} ದಿನ ಕಲಿಯಿರಿ"
],
"Learner": [
"शिक्षार्थी",
"ಕಲಿಕಾರ್ಥಿ"
],
"Learner Level": [
"शिक्षार्थी स्तर",
"ಕಲಿಕಾರ್ಥಿ ಹಂತ"
],
"Learner Nickname": [
"शिक्षार्थी का उपनाम",
"ಕಲಿಕಾರ್ಥಿಯ ಅಡ್ಡಹೆಸರು"
],
"Learner Preferred Name": [
"शिक्षार्थी का पसंदीदा नाम",
"ಕಲಿಕಾರ್ಥಿಯ ಆದ್ಯತೆಯ ಹೆಸರು"
],
"Learning Goal for Appu": [
"Appu के लिए सीखने का लक्ष्य",
"Appu ಗಾಗಿ ಕಲಿಕೆಯ ಗುರಿ"
],
"Learning Missions": [
"सीखने के मिशन",
"ಕಲಿಕೆಯ ಮಿಷನ್‌ಗಳು"
],
"Learning Progress": [
"सीखने की प्रगति",
"ಕಲಿಕೆಯ ಪ್ರಗತಿ"
],
"Learning Quest": [
"सीखने की खोज",
"ಕಲಿಕೆಯ ಅನ್ವೇಷಣೆ"
],
"Learning Stars": [
"सीखने के सितारे",
"ಕಲಿಕೆಯ ನಕ್ಷತ್ರಗಳು"
],
"Learning Streak": [
"सीखने की स्ट्रीक",
"ಕಲಿಕೆಯ ಸ್ಟ್ರೀಕ್"
],
"Learning Streak: {n} days": [
"सीखने की स्ट्रीक: {n} दिन",
"ಕಲಿಕೆಯ ಸ್ಟ್ರೀಕ್: {n} ದಿನಗಳು"
],
"Learning Style": [
"सीखने की शैली",
"ಕಲಿಕೆಯ ಶೈಲಿ"
],
"Legal": [
"कानूनी",
"ಕಾನೂನು"
],
"Legal page": [
"कानूनी पेज",
"ಕಾನೂನು ಪುಟ"
],
"Lessons and mind maps you explore with Appu will automatically save here so you can revisit them anytime.": [
"Appu के साथ खोजे गए पाठ और माइंड मैप यहाँ अपने-आप सहेजे जाएँगे, ताकि आप कभी भी दोबारा देख सकें।",
"Appu ಜೊತೆ ಅನ್ವೇಷಿಸಿದ ಪಾಠಗಳು ಮತ್ತು ಮೈಂಡ್ ಮ್ಯಾಪ್‌ಗಳು ಇಲ್ಲಿ ತಾನಾಗಿ ಉಳಿಯುತ್ತವೆ, ಯಾವಾಗ ಬೇಕಾದರೂ ಮತ್ತೆ ನೋಡಬಹುದು."
],
"Level {n}: Brain Booster 💡": [
"स्तर {n}: दिमाग़ी ताकत 💡",
"ಹಂತ {n}: ಬುದ್ಧಿ ವರ್ಧಕ 💡"
],
"Level {n}: Curious Explorer 🚀": [
"स्तर {n}: जिज्ञासु खोजकर्ता 🚀",
"ಹಂತ {n}: ಕುತೂಹಲಿ ಅನ್ವೇಷಕ 🚀"
],
"Level {n}: Master Mind 🏆": [
"स्तर {n}: मास्टर माइंड 🏆",
"ಹಂತ {n}: ಮಾಸ್ಟರ್ ಮೈಂಡ್ 🏆"
],
"Level {n}: Seedling Scholar": [
"स्तर {n}: नन्हा विद्वान",
"ಹಂತ {n}: ಮೊಳಕೆ ವಿದ್ವಾಂಸ"
],
"Level {n}: Seedling Scholar 🌱": [
"स्तर {n}: नन्हा विद्वान 🌱",
"ಹಂತ {n}: ಮೊಳಕೆ ವಿದ್ವಾಂಸ 🌱"
],
"Level {n}: Seedling Scholar, {n} of {n} XP to Level {n}": [
"स्तर {n}: नन्हा विद्वान, स्तर {n} तक {n} में से {n} XP",
"ಹಂತ {n}: ಮೊಳಕೆ ವಿದ್ವಾಂಸ, ಹಂತ {n}ಕ್ಕೆ {n}ರಲ್ಲಿ {n} XP"
],
"Level {n}: Star Student 🌟": [
"स्तर {n}: स्टार छात्र 🌟",
"ಹಂತ {n}: ತಾರಾ ವಿದ್ಯಾರ್ಥಿ 🌟"
],
"Light Mode": [
"लाइट मोड",
"ಲೈಟ್ ಮೋಡ್"
],
"Light theme": [
"लाइट थीम",
"ಲೈಟ್ ಥೀಮ್"
],
"Listening…": [
"सुन रहा है…",
"ಆಲಿಸುತ್ತಿದೆ…"
],
"Log in or sign up": [
"लॉग इन या साइन अप करें",
"ಲಾಗಿನ್ ಅಥವಾ ಸೈನ್ ಅಪ್"
],
"Lvl {n}": [
"स्तर {n}",
"ಹಂತ {n}"
],
"Main navigation": [
"मुख्य नेविगेशन",
"ಮುಖ್ಯ ನ್ಯಾವಿಗೇಶನ್"
],
"Make Appu comfortable for you": [
"Appu को अपने लिए आरामदायक बनाएँ",
"Appu ಅನ್ನು ನಿಮಗೆ ಅನುಕೂಲಕರವಾಗಿಸಿ"
],
"Make a tricky idea feel simple": [
"कठिन बात को आसान बनाओ",
"ಕಷ್ಟದ ವಿಷಯವನ್ನು ಸುಲಭಗೊಳಿಸಿ"
],
"Master school science and build creative curiosity": [
"स्कूल विज्ञान में महारत और रचनात्मक जिज्ञासा",
"ಶಾಲಾ ವಿಜ್ಞಾನದಲ್ಲಿ ಪರಿಣತಿ ಮತ್ತು ಸೃಜನಶೀಲ ಕುತೂಹಲ"
],
"Master your first diagram to unlock": [
"अनलॉक करने के लिए अपना पहला चित्र पूरा करें",
"ಅನ್‌ಲಾಕ್ ಮಾಡಲು ಮೊದಲ ರೇಖಾಚಿತ್ರ ಪೂರ್ಣಗೊಳಿಸಿ"
],
"Master {n} flashcards to unlock": [
"अनलॉक करने के लिए {n} फ़्लैशकार्ड पूरे करें",
"ಅನ್‌ಲಾಕ್ ಮಾಡಲು {n} ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್ ಪೂರ್ಣಗೊಳಿಸಿ"
],
"Maybe later": [
"शायद बाद में",
"ಬಹುಶಃ ನಂತರ"
],
"Mind Map": [
"माइंड मैप",
"ಮೈಂಡ್ ಮ್ಯಾಪ್"
],
"More activities in my preferred language": [
"मेरी पसंदीदा भाषा में और गतिविधियाँ",
"ನನ್ನ ಆದ್ಯತೆಯ ಭಾಷೆಯಲ್ಲಿ ಇನ್ನಷ್ಟು ಚಟುವಟಿಕೆಗಳು"
],
"More practice quizzes and questions": [
"और अभ्यास क्विज़ और प्रश्न",
"ಇನ್ನಷ್ಟು ಅಭ್ಯಾಸ ಕ್ವಿಜ್ ಮತ್ತು ಪ್ರಶ್ನೆಗಳು"
],
"More real-world examples and stories": [
"और असली दुनिया के उदाहरण और कहानियाँ",
"ಇನ್ನಷ್ಟು ನೈಜ ಉದಾಹರಣೆಗಳು ಮತ್ತು ಕಥೆಗಳು"
],
"More subjects and chapters": [
"और विषय और अध्याय",
"ಇನ್ನಷ್ಟು ವಿಷಯಗಳು ಮತ್ತು ಅಧ್ಯಾಯಗಳು"
],
"My Learning": [
"मेरी पढ़ाई",
"ನನ್ನ ಕಲಿಕೆ"
],
"My Learning — Saved Lessons": [
"मेरी पढ़ाई — सहेजे गए पाठ",
"ನನ್ನ ಕಲಿಕೆ — ಉಳಿಸಿದ ಪಾಠಗಳು"
],
"My Progress": [
"मेरी प्रगति",
"ನನ್ನ ಪ್ರಗತಿ"
],
"My child enjoys learning with Appu": [
"मेरे बच्चे को Appu के साथ सीखना अच्छा लगता है",
"ನನ್ನ ಮಗು Appu ಜೊತೆ ಕಲಿಯುವುದನ್ನು ಆನಂದಿಸುತ್ತದೆ"
],
"Namaskara! Pick a learning mission, type a question, or tap the microphone to talk.": [
"नमस्कार! कोई सीखने का मिशन चुनें, प्रश्न लिखें, या बोलने के लिए माइक्रोफ़ोन दबाएँ।",
"ನಮಸ್ಕಾರ! ಕಲಿಕೆಯ ಮಿಷನ್ ಆರಿಸಿ, ಪ್ರಶ್ನೆ ಬರೆಯಿರಿ ಅಥವಾ ಮಾತನಾಡಲು ಮೈಕ್ರೊಫೋನ್ ಒತ್ತಿ."
],
"New chat": [
"नई चैट",
"ಹೊಸ ಚಾಟ್"
],
"Next: Level {n}": [
"अगला: स्तर {n}",
"ಮುಂದಿನದು: ಹಂತ {n}"
],
"No payment required. Sign up, verify your email, and get {n} free personalised chats.": [
"कोई भुगतान नहीं। साइन अप करें, ईमेल सत्यापित करें और {n} मुफ़्त निजी चैट पाएँ।",
"ಯಾವುದೇ ಪಾವತಿ ಬೇಕಿಲ್ಲ. ಸೈನ್ ಅಪ್ ಮಾಡಿ, ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿ ಮತ್ತು {n} ಉಚಿತ ವೈಯಕ್ತಿಕ ಚಾಟ್‌ಗಳನ್ನು ಪಡೆಯಿರಿ."
],
"No saved conversations yet.": [
"अभी कोई सहेजी गई बातचीत नहीं।",
"ಇನ್ನೂ ಉಳಿಸಿದ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ."
],
"No saved lessons yet": [
"अभी कोई सहेजा गया पाठ नहीं",
"ಇನ್ನೂ ಉಳಿಸಿದ ಪಾಠಗಳಿಲ್ಲ"
],
"Notes": [
"नोट्स",
"ಟಿಪ್ಪಣಿಗಳು"
],
"Off": [
"बंद",
"ಆಫ್"
],
"On": [
"चालू",
"ಆನ್"
],
"On Fire": [
"जोश में",
"ಉತ್ಸಾಹದ ಉರಿ"
],
"Open WhatsApp": [
"WhatsApp खोलें",
"WhatsApp ತೆರೆಯಿರಿ"
],
"Open lesson on stage": [
"पाठ खोलें",
"ಪಾಠ ತೆರೆಯಿರಿ"
],
"Open meeting link": [
"मीटिंग लिंक खोलें",
"ಸಭೆಯ ಲಿಂಕ್ ತೆರೆಯಿರಿ"
],
"Open menu": [
"मेनू खोलें",
"ಮೆನು ತೆರೆಯಿರಿ"
],
"Open voice settings": [
"आवाज़ सेटिंग्स खोलें",
"ಧ್ವನಿ ಸೆಟ್ಟಿಂಗ್ ತೆರೆಯಿರಿ"
],
"Other — tell us in your words": [
"अन्य — अपने शब्दों में बताएँ",
"ಇತರೆ — ನಿಮ್ಮ ಮಾತಿನಲ್ಲಿ ತಿಳಿಸಿ"
],
"Overall rating": [
"कुल रेटिंग",
"ಒಟ್ಟು ರೇಟಿಂಗ್"
],
"Parent / Guardian Email": [
"अभिभावक ईमेल",
"ಪೋಷಕರ ಇಮೇಲ್"
],
"Parent Setup": [
"अभिभावक सेटअप",
"ಪೋಷಕರ ಸೆಟಪ್"
],
"Parent WhatsApp Number": [
"अभिभावक WhatsApp नंबर",
"ಪೋಷಕರ WhatsApp ಸಂಖ್ಯೆ"
],
"Parent Zone": [
"अभिभावक क्षेत्र",
"ಪೋಷಕರ ವಲಯ"
],
"Parent Zone & Controls": [
"अभिभावक क्षेत्र और नियंत्रण",
"ಪೋಷಕರ ವಲಯ ಮತ್ತು ನಿಯಂತ್ರಣಗಳು"
],
"Parent Zone • Progress": [
"अभिभावक क्षेत्र • प्रगति",
"ಪೋಷಕರ ವಲಯ • ಪ್ರಗತಿ"
],
"Parent Zone • Study Time Limit": [
"अभिभावक क्षेत्र • पढ़ाई समय सीमा",
"ಪೋಷಕರ ವಲಯ • ಓದುವ ಸಮಯ ಮಿತಿ"
],
"Parent/Guardian name": [
"अभिभावक का नाम",
"ಪೋಷಕರ ಹೆಸರು"
],
"Parental study timer": [
"अभिभावक पढ़ाई टाइमर",
"ಪೋಷಕರ ಓದುವ ಟೈಮರ್"
],
"Parents stay in charge": [
"माता-पिता का नियंत्रण",
"ಪೋಷಕರ ನಿಯಂತ್ರಣ"
],
"Password": [
"पासवर्ड",
"ಪಾಸ್‌ವರ್ಡ್"
],
"Paste Text": [
"टेक्स्ट पेस्ट करें",
"ಪಠ್ಯ ಅಂಟಿಸಿ"
],
"Paste text from your digital notes, PDF, or study guide here...": [
"अपने डिजिटल नोट्स, PDF या स्टडी गाइड का टेक्स्ट यहाँ पेस्ट करें...",
"ನಿಮ್ಮ ಡಿಜಿಟಲ್ ಟಿಪ್ಪಣಿ, PDF ಅಥವಾ ಅಧ್ಯಯನ ಮಾರ್ಗದರ್ಶಿಯ ಪಠ್ಯ ಇಲ್ಲಿ ಅಂಟಿಸಿ..."
],
"Paste textbook or notes content": [
"पाठ्यपुस्तक या नोट्स की सामग्री पेस्ट करें",
"ಪಠ್ಯಪುಸ್ತಕ ಅಥವಾ ಟಿಪ್ಪಣಿ ವಿಷಯ ಅಂಟಿಸಿ"
],
"Personalization Sections": [
"निजीकरण अनुभाग",
"ವೈಯಕ್ತೀಕರಣ ವಿಭಾಗಗಳು"
],
"Personalize": [
"निजी बनाएँ",
"ವೈಯಕ್ತೀಕರಿಸಿ"
],
"Personalize Appu for": [
"Appu को निजी बनाएँ",
"Appu ಅನ್ನು ವೈಯಕ್ತೀಕರಿಸಿ"
],
"Personalized Appu is Ready!": [
"आपका निजी Appu तैयार है!",
"ವೈಯಕ್ತೀಕೃತ Appu ಸಿದ್ಧವಾಗಿದೆ!"
],
"Personalized explanations for your syllabus": [
"आपके पाठ्यक्रम के लिए निजी व्याख्याएँ",
"ನಿಮ್ಮ ಪಠ್ಯಕ್ರಮಕ್ಕೆ ವೈಯಕ್ತಿಕ ವಿವರಣೆಗಳು"
],
"Personalized sparks for your learning journey": [
"आपकी सीखने की यात्रा के लिए खास सुझाव",
"ನಿಮ್ಮ ಕಲಿಕೆಯ ಪಯಣಕ್ಕಾಗಿ ವಿಶೇಷ ಸಲಹೆಗಳು"
],
"Photo of homework": [
"होमवर्क की फ़ोटो",
"ಹೋಮ್‌ವರ್ಕ್ ಫೋಟೋ"
],
"Plan": [
"योजना",
"ಯೋಜನೆ"
],
"Plan a learning support call": [
"सीखने में मदद के लिए कॉल तय करें",
"ಕಲಿಕೆ ಬೆಂಬಲ ಕರೆ ಯೋಜಿಸಿ"
],
"Play a Quick Quiz": [
"एक छोटा क्विज़ खेलें",
"ಒಂದು ಚಿಕ್ಕ ಕ್ವಿಜ್ ಆಡಿ"
],
"Play answers aloud": [
"जवाब ज़ोर से सुनाएँ",
"ಉತ್ತರಗಳನ್ನು ಗಟ್ಟಿಯಾಗಿ ಓದಿ"
],
"Playful & Encouraging": [
"मज़ेदार और प्रोत्साहक",
"ಮೋಜಿನ ಮತ್ತು ಪ್ರೋತ್ಸಾಹಕ"
],
"Podcast": [
"पॉडकास्ट",
"ಪಾಡ್‌ಕಾಸ್ಟ್"
],
"Prefer not to say": [
"बताना नहीं चाहते",
"ಹೇಳಲು ಇಷ್ಟವಿಲ್ಲ"
],
"Preferences": [
"पसंद",
"ಆದ್ಯತೆಗಳು"
],
"Preferred date and time": [
"पसंदीदा तारीख और समय",
"ಆದ್ಯತೆಯ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ"
],
"Pricing": [
"मूल्य",
"ಬೆಲೆ"
],
"Primary Language": [
"मुख्य भाषा",
"ಪ್ರಾಥಮಿಕ ಭಾಷೆ"
],
"Privacy Policy": [
"गोपनीयता नीति",
"ಗೌಪ್ಯತಾ ನೀತಿ"
],
"Progress reports, study-time limits and WhatsApp updates for parents.": [
"माता-पिता के लिए प्रगति रिपोर्ट, पढ़ाई-समय सीमा और WhatsApp अपडेट।",
"ಪೋಷಕರಿಗೆ ಪ್ರಗತಿ ವರದಿಗಳು, ಓದುವ ಸಮಯದ ಮಿತಿ ಮತ್ತು WhatsApp ಅಪ್‌ಡೇಟ್‌ಗಳು."
],
"Prompt Library": [
"प्रॉम्प्ट लाइब्रेरी",
"ಪ್ರಾಂಪ್ಟ್ ಲೈಬ್ರರಿ"
],
"Prompt categories": [
"प्रॉम्प्ट श्रेणियाँ",
"ಪ್ರಾಂಪ್ಟ್ ವರ್ಗಗಳು"
],
"Public Beta • Free Signup": [
"पब्लिक बीटा • मुफ़्त साइन अप",
"ಸಾರ್ವಜನಿಕ ಬೀಟಾ • ಉಚಿತ ಸೈನ್ ಅಪ್"
],
"Quick Concepts": [
"त्वरित अवधारणाएँ",
"ತ್ವರಿತ ಪರಿಕಲ್ಪನೆಗಳು"
],
"Quick Thinker": [
"तेज़ विचारक",
"ಚುರುಕು ಚಿಂತಕ"
],
"Quiz": [
"क्विज़",
"ಕ್ವಿಜ್"
],
"Reading & Writing (structured notes)": [
"पढ़ना और लिखना (व्यवस्थित नोट्स)",
"ಓದು ಮತ್ತು ಬರಹ (ವ್ಯವಸ್ಥಿತ ಟಿಪ್ಪಣಿಗಳು)"
],
"Reading Font Style": [
"पढ़ने की फ़ॉन्ट शैली",
"ಓದುವ ಫಾಂಟ್ ಶೈಲಿ"
],
"Ready": [
"तैयार",
"ಸಿದ್ಧ"
],
"Recent chats": [
"हाल की चैट",
"ಇತ್ತೀಚಿನ ಚಾಟ್‌ಗಳು"
],
"Refresh prompts": [
"प्रॉम्प्ट रीफ़्रेश करें",
"ಪ್ರಾಂಪ್ಟ್‌ಗಳನ್ನು ರಿಫ್ರೆಶ್ ಮಾಡಿ"
],
"Remove": [
"हटाएँ",
"ತೆಗೆದುಹಾಕಿ"
],
"Remove attached photo": [
"लगाई गई फ़ोटो हटाएँ",
"ಲಗತ್ತಿಸಿದ ಫೋಟೋ ತೆಗೆದುಹಾಕಿ"
],
"Remove saved lesson": [
"सहेजा गया पाठ हटाएँ",
"ಉಳಿಸಿದ ಪಾಠ ತೆಗೆದುಹಾಕಿ"
],
"Remove selected file": [
"चुनी गई फ़ाइल हटाएँ",
"ಆಯ್ದ ಫೈಲ್ ತೆಗೆದುಹಾಕಿ"
],
"Report": [
"रिपोर्ट",
"ವರದಿ"
],
"Required": [
"ज़रूरी",
"ಅಗತ್ಯ"
],
"Resend Code": [
"कोड दोबारा भेजें",
"ಕೋಡ್ ಮತ್ತೆ ಕಳುಹಿಸಿ"
],
"Response Style": [
"जवाब की शैली",
"ಪ್ರತಿಕ್ರಿಯೆ ಶೈಲಿ"
],
"Return to Appu": [
"Appu पर लौटें",
"Appu ಗೆ ಹಿಂತಿರುಗಿ"
],
"Revise smarter and build confidence": [
"समझदारी से दोहराएँ और आत्मविश्वास बढ़ाएँ",
"ಜಾಣ್ಮೆಯಿಂದ ಪುನರಾವರ್ತಿಸಿ, ಆತ್ಮವಿಶ್ವಾಸ ಬೆಳೆಸಿ"
],
"Save Learner & Continue": [
"शिक्षार्थी सहेजें और जारी रखें",
"ಕಲಿಕಾರ್ಥಿಯನ್ನು ಉಳಿಸಿ ಮುಂದುವರಿಸಿ"
],
"Save Preferences & Launch": [
"पसंद सहेजें और शुरू करें",
"ಆದ್ಯತೆಗಳನ್ನು ಉಳಿಸಿ ಪ್ರಾರಂಭಿಸಿ"
],
"Save chat history across all your devices": [
"अपने सभी डिवाइस पर चैट इतिहास सहेजें",
"ನಿಮ್ಮ ಎಲ್ಲಾ ಸಾಧನಗಳಲ್ಲಿ ಚಾಟ್ ಇತಿಹಾಸ ಉಳಿಸಿ"
],
"Save preferences": [
"पसंद सहेजें",
"ಆದ್ಯತೆಗಳನ್ನು ಉಳಿಸಿ"
],
"Science, Mathematics, Coding": [
"विज्ञान, गणित, कोडिंग",
"ವಿಜ್ಞಾನ, ಗಣಿತ, ಕೋಡಿಂಗ್"
],
"Select Gender (Optional)": [
"लिंग चुनें (वैकल्पिक)",
"ಲಿಂಗ ಆರಿಸಿ (ಐಚ್ಛಿಕ)"
],
"Send Unlock Code to Parent WhatsApp": [
"अभिभावक के WhatsApp पर अनलॉक कोड भेजें",
"ಪೋಷಕರ WhatsApp ಗೆ ಅನ್‌ಲಾಕ್ ಕೋಡ್ ಕಳುಹಿಸಿ"
],
"Send me occasional learning milestones, daily study summaries, and study notes for my child on WhatsApp.": [
"मुझे WhatsApp पर मेरे बच्चे की सीखने की उपलब्धियाँ, रोज़ की पढ़ाई का सारांश और नोट्स भेजें।",
"ನನ್ನ ಮಗುವಿನ ಕಲಿಕೆಯ ಸಾಧನೆಗಳು, ದೈನಂದಿನ ಅಧ್ಯಯನ ಸಾರಾಂಶ ಮತ್ತು ಟಿಪ್ಪಣಿಗಳನ್ನು WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿ."
],
"Send question": [
"प्रश्न भेजें",
"ಪ್ರಶ್ನೆ ಕಳುಹಿಸಿ"
],
"Send to Appu": [
"Appu को भेजें",
"Appu ಗೆ ಕಳುಹಿಸಿ"
],
"Send to WhatsApp": [
"WhatsApp पर भेजें",
"WhatsApp ಗೆ ಕಳುಹಿಸಿ"
],
"Session Unlocked!": [
"सत्र खुल गया!",
"ಅವಧಿ ತೆರೆಯಲಾಗಿದೆ!"
],
"Settings": [
"सेटिंग्स",
"ಸೆಟ್ಟಿಂಗ್‌ಗಳು"
],
"Setup progress": [
"सेटअप प्रगति",
"ಸೆಟಪ್ ಪ್ರಗತಿ"
],
"Share lesson notes via WhatsApp": [
"पाठ नोट्स WhatsApp पर साझा करें",
"ಪಾಠ ಟಿಪ್ಪಣಿ WhatsApp ಮೂಲಕ ಹಂಚಿ"
],
"Shipping & Delivery": [
"शिपिंग और डिलीवरी",
"ಶಿಪ್ಪಿಂಗ್ ಮತ್ತು ವಿತರಣೆ"
],
"Sign In": [
"साइन इन",
"ಸೈನ್ ಇನ್"
],
"Sign In to Parent Zone": [
"अभिभावक क्षेत्र में साइन इन करें",
"ಪೋಷಕರ ವಲಯಕ್ಕೆ ಸೈನ್ ಇನ್ ಮಾಡಿ"
],
"Sign in": [
"साइन इन",
"ಸೈನ್ ಇನ್"
],
"Sign in / Sign up": [
"साइन इन / साइन अप",
"ಸೈನ್ ಇನ್ / ಸೈನ್ ಅಪ್"
],
"Sign in to continue learning, save your progress, and unlock tailored study plans.": [
"सीखना जारी रखने, प्रगति सहेजने और खास पढ़ाई योजनाएँ पाने के लिए साइन इन करें।",
"ಕಲಿಕೆ ಮುಂದುವರಿಸಲು, ಪ್ರಗತಿ ಉಳಿಸಲು ಮತ್ತು ವಿಶೇಷ ಅಧ್ಯಯನ ಯೋಜನೆಗಳನ್ನು ಪಡೆಯಲು ಸೈನ್ ಇನ್ ಮಾಡಿ."
],
"Skip": [
"छोड़ें",
"ಬಿಟ್ಟುಬಿಡಿ"
],
"Skip for now": [
"अभी छोड़ें",
"ಈಗ ಬಿಟ್ಟುಬಿಡಿ"
],
"Slower can make explanations easier to follow.": [
"धीमी गति से समझना आसान हो सकता है।",
"ನಿಧಾನವಾದರೆ ವಿವರಣೆ ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವುದು ಸುಲಭ."
],
"Sound Effects": [
"ध्वनि प्रभाव",
"ಧ್ವನಿ ಪರಿಣಾಮಗಳು"
],
"Sound effects": [
"ध्वनि प्रभाव",
"ಧ್ವನಿ ಪರಿಣಾಮಗಳು"
],
"Space Cadet": [
"अंतरिक्ष कैडेट",
"ಬಾಹ್ಯಾಕಾಶ ಕೆಡೆಟ್"
],
"Space, Robotics, Astronomy, Dinosaurs": [
"अंतरिक्ष, रोबोटिक्स, खगोल विज्ञान, डायनासोर",
"ಬಾಹ್ಯಾಕಾಶ, ರೋಬೋಟಿಕ್ಸ್, ಖಗೋಳಶಾಸ್ತ್ರ, ಡೈನೋಸಾರ್"
],
"Speaking speed": [
"बोलने की गति",
"ಮಾತಿನ ವೇಗ"
],
"Stars": [
"सितारे",
"ನಕ್ಷತ್ರಗಳು"
],
"Starter questions": [
"शुरुआती प्रश्न",
"ಆರಂಭಿಕ ಪ್ರಶ್ನೆಗಳು"
],
"Step-by-step answers with mind maps, quizzes and flashcards.": [
"माइंड मैप, क्विज़ और फ़्लैशकार्ड के साथ कदम-दर-कदम जवाब।",
"ಮೈಂಡ್ ಮ್ಯಾಪ್, ಕ್ವಿಜ್ ಮತ್ತು ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್‌ಗಳೊಂದಿಗೆ ಹಂತ ಹಂತದ ಉತ್ತರಗಳು."
],
"Streak": [
"स्ट्रीक",
"ಸ್ಟ್ರೀಕ್"
],
"Study Lesson": [
"पाठ पढ़ें",
"ಪಾಠ ಓದಿ"
],
"Study Time Complete! 🌟": [
"पढ़ाई का समय पूरा! 🌟",
"ಓದುವ ಸಮಯ ಮುಗಿದಿದೆ! 🌟"
],
"Submit feedback & unlock report": [
"फ़ीडबैक भेजें और रिपोर्ट खोलें",
"ಪ್ರತಿಕ್ರಿಯೆ ಕಳುಹಿಸಿ ವರದಿ ತೆರೆಯಿರಿ"
],
"Supports PDF, TXT or Markdown files (up to {n}MB)": [
"PDF, TXT या Markdown फ़ाइलें ({n}MB तक)",
"PDF, TXT ಅಥವಾ Markdown ಫೈಲ್‌ಗಳು ({n}MB ವರೆಗೆ)"
],
"Switch to dark theme": [
"डार्क थीम पर जाएँ",
"ಡಾರ್ಕ್ ಥೀಮ್‌ಗೆ ಬದಲಿಸಿ"
],
"Switch to light theme": [
"लाइट थीम पर जाएँ",
"ಲೈಟ್ ಥೀಮ್‌ಗೆ ಬದಲಿಸಿ"
],
"Take the tour 🎈": [
"टूर लें 🎈",
"ಪ್ರವಾಸ ಕೈಗೊಳ್ಳಿ 🎈"
],
"Talk to Appu": [
"Appu से बात करें",
"Appu ಜೊತೆ ಮಾತನಾಡಿ"
],
"Talks with you": [
"आपसे बात करता है",
"ನಿಮ್ಮೊಂದಿಗೆ ಮಾತನಾಡುತ್ತದೆ"
],
"Tap Appu or just talk to interrupt": [
"रोकने के लिए Appu को टैप करें या बस बोलें",
"ತಡೆಯಲು Appu ಟ್ಯಾಪ್ ಮಾಡಿ ಅಥವಾ ಸುಮ್ಮನೆ ಮಾತನಾಡಿ"
],
"Tap to interrupt Appu": [
"Appu को रोकने के लिए टैप करें",
"Appu ಅನ್ನು ತಡೆಯಲು ಟ್ಯಾಪ್ ಮಾಡಿ"
],
"Tap to speak to Appu": [
"Appu से बोलने के लिए टैप करें",
"Appu ಜೊತೆ ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ"
],
"Tap to type a message to Appu": [
"Appu को संदेश लिखने के लिए टैप करें",
"Appu ಗೆ ಸಂದೇಶ ಬರೆಯಲು ಟ್ಯಾಪ್ ಮಾಡಿ"
],
"Teach Me From This": [
"इससे मुझे पढ़ाओ",
"ಇದರಿಂದ ನನಗೆ ಕಲಿಸಿ"
],
"Teaching from this": [
"इससे पढ़ा रहा है",
"ಇದರಿಂದ ಕಲಿಸುತ್ತಿದೆ"
],
"Tell us what would make Appu even better…": [
"बताएँ कि Appu को और बेहतर क्या बनाएगा…",
"Appu ಅನ್ನು ಇನ್ನೂ ಉತ್ತಮಗೊಳಿಸುವುದು ಯಾವುದು ತಿಳಿಸಿ…"
],
"Tell us what you like most about Appu…": [
"बताएँ कि आपको Appu में सबसे अच्छा क्या लगता है…",
"Appu ನಲ್ಲಿ ನಿಮಗೆ ಹೆಚ್ಚು ಇಷ್ಟವಾದುದನ್ನು ತಿಳಿಸಿ…"
],
"Terms": [
"शर्तों",
"ನಿಯಮಗಳಿಗೆ"
],
"Terms & Conditions": [
"नियम और शर्तें",
"ನಿಯಮಗಳು ಮತ್ತು ಷರತ್ತುಗಳು"
],
"Test Mode": [
"टेस्ट मोड",
"ಪರೀಕ್ಷಾ ಮೋಡ್"
],
"The personalised, by-name approach really helps": [
"नाम लेकर निजी तरीका सच में मदद करता है",
"ಹೆಸರಿನಿಂದ ಕರೆಯುವ ವೈಯಕ್ತಿಕ ವಿಧಾನ ನಿಜವಾಗಿಯೂ ಸಹಾಯ ಮಾಡುತ್ತದೆ"
],
"The voice and interactive features are great": [
"आवाज़ और इंटरैक्टिव सुविधाएँ बढ़िया हैं",
"ಧ್ವನಿ ಮತ್ತು ಸಂವಾದಾತ್ಮಕ ವೈಶಿಷ್ಟ್ಯಗಳು ಅದ್ಭುತ"
],
"Thinking…": [
"सोच रहा है…",
"ಯೋಚಿಸುತ್ತಿದೆ…"
],
"Today, {n}:{n}": [
"आज, {n}:{n}",
"ಇಂದು, {n}:{n}"
],
"Top level reached": [
"सबसे ऊँचा स्तर पा लिया",
"ಅತ್ಯುನ್ನತ ಹಂತ ತಲುಪಿದ್ದೀರಿ"
],
"Total Stars": [
"कुल सितारे",
"ಒಟ್ಟು ನಕ್ಷತ್ರಗಳು"
],
"Try Beta — Sign Up Free": [
"बीटा आज़माएँ — मुफ़्त साइन अप",
"ಬೀಟಾ ಪ್ರಯತ್ನಿಸಿ — ಉಚಿತ ಸೈನ್ ಅಪ್"
],
"Try again": [
"फिर कोशिश करें",
"ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ"
],
"Type instead": [
"इसके बजाय लिखें",
"ಬದಲಾಗಿ ಟೈಪ್ ಮಾಡಿ"
],
"Unlocked": [
"अनलॉक",
"ಅನ್‌ಲಾಕ್ ಆಗಿದೆ"
],
"Unlocked: Answer {n} quiz questions correctly": [
"अनलॉक: {n} क्विज़ प्रश्नों के सही जवाब",
"ಅನ್‌ಲಾಕ್: {n} ಕ್ವಿಜ್ ಪ್ರಶ್ನೆಗಳಿಗೆ ಸರಿಯಾದ ಉತ್ತರ"
],
"Unlocked: Ask Appu your first question": [
"अनलॉक: Appu से पहला प्रश्न पूछा",
"ಅನ್‌ಲಾಕ್: Appu ಗೆ ಮೊದಲ ಪ್ರಶ್ನೆ ಕೇಳಿದ್ದೀರಿ"
],
"Unlocked: Ask Appu {n} questions": [
"अनलॉक: Appu से {n} प्रश्न पूछे",
"ಅನ್‌ಲಾಕ್: Appu ಗೆ {n} ಪ್ರಶ್ನೆ ಕೇಳಿದ್ದೀರಿ"
],
"Unlocked: Learn {n} days in a row": [
"अनलॉक: लगातार {n} दिन पढ़ाई",
"ಅನ್‌ಲಾಕ್: ಸತತ {n} ದಿನ ಕಲಿಕೆ"
],
"Unlocked: Master your first diagram": [
"अनलॉक: पहला चित्र पूरा",
"ಅನ್‌ಲಾಕ್: ಮೊದಲ ರೇಖಾಚಿತ್ರ ಪೂರ್ಣ"
],
"Unlocked: Master {n} flashcards": [
"अनलॉक: {n} फ़्लैशकार्ड पूरे",
"ಅನ್‌ಲಾಕ್: {n} ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್ ಪೂರ್ಣ"
],
"Upload PDF / File": [
"PDF / फ़ाइल अपलोड",
"PDF / ಫೈಲ್ ಅಪ್‌ಲೋಡ್"
],
"Upload method": [
"अपलोड का तरीका",
"ಅಪ್‌ಲೋಡ್ ವಿಧಾನ"
],
"Upload notes": [
"नोट्स अपलोड करें",
"ಟಿಪ್ಪಣಿಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ"
],
"Upload notes or textbook": [
"नोट्स या पाठ्यपुस्तक अपलोड करें",
"ಟಿಪ್ಪಣಿ ಅಥವಾ ಪಠ್ಯಪುಸ್ತಕ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ"
],
"Upload your class notes, textbook PDF, or paste text. Appu will create a mind map, step-by-step lesson, and quiz directly from your material!": [
"अपने क्लास नोट्स, पाठ्यपुस्तक PDF अपलोड करें या टेक्स्ट पेस्ट करें। Appu सीधे आपकी सामग्री से माइंड मैप, कदम-दर-कदम पाठ और क्विज़ बनाएगा!",
"ನಿಮ್ಮ ತರಗತಿ ಟಿಪ್ಪಣಿ, ಪಠ್ಯಪುಸ್ತಕ PDF ಅಪ್‌ಲೋಡ್ ಮಾಡಿ ಅಥವಾ ಪಠ್ಯ ಅಂಟಿಸಿ. Appu ನೇರವಾಗಿ ನಿಮ್ಮ ವಿಷಯದಿಂದ ಮೈಂಡ್ ಮ್ಯಾಪ್, ಹಂತ ಹಂತದ ಪಾಠ ಮತ್ತು ಕ್ವಿಜ್ ರಚಿಸುತ್ತದೆ!"
],
"Verify & Continue Learning": [
"सत्यापित करें और पढ़ाई जारी रखें",
"ಪರಿಶೀಲಿಸಿ ಕಲಿಕೆ ಮುಂದುವರಿಸಿ"
],
"View Progress Report": [
"प्रगति रिपोर्ट देखें",
"ಪ್ರಗತಿ ವರದಿ ನೋಡಿ"
],
"View learning plans": [
"सीखने की योजनाएँ देखें",
"ಕಲಿಕೆಯ ಯೋಜನೆಗಳನ್ನು ನೋಡಿ"
],
"Visit IGr Academy": [
"IGr Academy देखें",
"IGr Academy ಗೆ ಭೇಟಿ ನೀಡಿ"
],
"Visual (examples & diagrams)": [
"दृश्य (उदाहरण और चित्र)",
"ದೃಶ್ಯ (ಉದಾಹರಣೆಗಳು ಮತ್ತು ರೇಖಾಚಿತ್ರಗಳು)"
],
"Voice call with Appu": [
"Appu के साथ वॉइस कॉल",
"Appu ಜೊತೆ ಧ್ವನಿ ಕರೆ"
],
"Voice practice in English, Kannada and Hindi": [
"अंग्रेज़ी, कन्नड़ और हिंदी में आवाज़ अभ्यास",
"ಇಂಗ್ಲಿಷ್, ಕನ್ನಡ ಮತ್ತು ಹಿಂದಿಯಲ್ಲಿ ಧ್ವನಿ ಅಭ್ಯಾಸ"
],
"Voice settings": [
"आवाज़ सेटिंग्स",
"ಧ್ವನಿ ಸೆಟ್ಟಿಂಗ್‌ಗಳು"
],
"We couldn't load your reports right now.": [
"अभी आपकी रिपोर्ट लोड नहीं हो सकीं।",
"ಈಗ ನಿಮ್ಮ ವರದಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ."
],
"Week Warrior": [
"सप्ताह योद्धा",
"ವಾರದ ಯೋಧ"
],
"Welcome to": [
"आपका स्वागत है",
"ಸ್ವಾಗತ"
],
"What causes seasons?": [
"ऋतुएँ क्यों बदलती हैं?",
"ಋತುಗಳು ಏಕೆ ಬದಲಾಗುತ್ತವೆ?"
],
"What shall we learn today?": [
"आज हम क्या सीखें?",
"ಇಂದು ನಾವು ಏನು ಕಲಿಯೋಣ?"
],
"What support would help most?": [
"किस मदद से सबसे ज़्यादा फ़ायदा होगा?",
"ಯಾವ ಬೆಂಬಲ ಹೆಚ್ಚು ಸಹಾಯಕವಾಗುತ್ತದೆ?"
],
"What would make it even better?": [
"इसे और बेहतर क्या बनाएगा?",
"ಇದನ್ನು ಇನ್ನೂ ಉತ್ತಮಗೊಳಿಸುವುದು ಯಾವುದು?"
],
"What's working well?": [
"क्या अच्छा चल रहा है?",
"ಯಾವುದು ಚೆನ್ನಾಗಿದೆ?"
],
"WhatsApp number": [
"WhatsApp नंबर",
"WhatsApp ಸಂಖ್ಯೆ"
],
"Why is the sky blue?": [
"आसमान नीला क्यों है?",
"ಆಕಾಶ ನೀಲಿ ಏಕೆ?"
],
"XP Stars: {n}": [
"XP सितारे: {n}",
"XP ನಕ್ಷತ್ರಗಳು: {n}"
],
"You're all set!": [
"सब तैयार है!",
"ಎಲ್ಲವೂ ಸಿದ್ಧ!"
],
"You've completed {n} minutes of focused learning with Appu! It's a great time to stretch, hydrate, or take a quick break. To continue learning, ask your parent to unlock this session with a WhatsApp verification code.": [
"आपने Appu के साथ {n} मिनट ध्यान से पढ़ाई पूरी की! अब थोड़ा स्ट्रेच करें, पानी पिएँ या छोटा ब्रेक लें। आगे पढ़ने के लिए अभिभावक से WhatsApp सत्यापन कोड से यह सत्र खुलवाएँ।",
"ನೀವು Appu ಜೊತೆ {n} ನಿಮಿಷಗಳ ಏಕಾಗ್ರ ಕಲಿಕೆ ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ! ಈಗ ಸ್ವಲ್ಪ ಮೈ ಚಾಚಿ, ನೀರು ಕುಡಿಯಿರಿ ಅಥವಾ ಸಣ್ಣ ವಿರಾಮ ತೆಗೆದುಕೊಳ್ಳಿ. ಕಲಿಕೆ ಮುಂದುವರಿಸಲು WhatsApp ಪರಿಶೀಲನಾ ಕೋಡ್ ಮೂಲಕ ಈ ಅವಧಿಯನ್ನು ತೆರೆಯಲು ಪೋಷಕರನ್ನು ಕೇಳಿ."
],
"Your AI learning companion for class {n} to {n}. Sign in to save progress and personalize Appu for your child.": [
"कक्षा {n} से {n} के लिए आपका AI सीखने का साथी। प्रगति सहेजने और अपने बच्चे के लिए Appu को निजी बनाने हेतु साइन इन करें।",
"{n} ರಿಂದ {n}ನೇ ತರಗತಿಗೆ ನಿಮ್ಮ AI ಕಲಿಕೆಯ ಸಂಗಾತಿ. ಪ್ರಗತಿ ಉಳಿಸಲು ಮತ್ತು ನಿಮ್ಮ ಮಗುವಿಗಾಗಿ Appu ಅನ್ನು ವೈಯಕ್ತೀಕರಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ."
],
"Your child explored these advanced topics with great curiosity. We celebrate their enthusiasm for learning beyond grade-level expectations!": [
"आपके बच्चे ने इन उन्नत विषयों को बड़ी जिज्ञासा से खोजा। हम कक्षा-स्तर से आगे सीखने के उनके उत्साह का जश्न मनाते हैं!",
"ನಿಮ್ಮ ಮಗು ಈ ಉನ್ನತ ವಿಷಯಗಳನ್ನು ಬಹಳ ಕುತೂಹಲದಿಂದ ಅನ್ವೇಷಿಸಿದೆ. ತರಗತಿ ಮಟ್ಟ ಮೀರಿ ಕಲಿಯುವ ಅವರ ಉತ್ಸಾಹವನ್ನು ನಾವು ಆಚರಿಸುತ್ತೇವೆ!"
],
"Your child's report is ready to generate. It analyzes their conversations with Appu across the app, website, and WhatsApp, and produces a designed PDF with an overall score, subject breakdown, strengths, and recommendations.": [
"आपके बच्चे की रिपोर्ट बनाने के लिए तैयार है। यह ऐप, वेबसाइट और WhatsApp पर Appu के साथ उनकी बातचीत का विश्लेषण करके कुल स्कोर, विषयवार विवरण, ताकत और सुझावों वाली एक PDF बनाती है।",
"ನಿಮ್ಮ ಮಗುವಿನ ವರದಿ ತಯಾರಿಸಲು ಸಿದ್ಧವಾಗಿದೆ. ಇದು ಆಪ್, ವೆಬ್‌ಸೈಟ್ ಮತ್ತು WhatsApp ನಲ್ಲಿ Appu ಜೊತೆಗಿನ ಸಂಭಾಷಣೆಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಿ ಒಟ್ಟು ಅಂಕ, ವಿಷಯವಾರು ವಿವರ, ಸಾಮರ್ಥ್ಯಗಳು ಮತ್ತು ಸಲಹೆಗಳಿರುವ PDF ರಚಿಸುತ್ತದೆ."
],
"Your complimentary APPU chats are complete": [
"आपकी मुफ़्त APPU चैट पूरी हो गई हैं",
"ನಿಮ್ಮ ಉಚಿತ APPU ಚಾಟ್‌ಗಳು ಮುಗಿದಿವೆ"
],
"Your date of birth (parent / guardian)": [
"आपकी जन्मतिथि (अभिभावक)",
"ನಿಮ್ಮ ಜನ್ಮ ದಿನಾಂಕ (ಪೋಷಕರು)"
],
"Your details are used only to arrange this support call.": [
"आपकी जानकारी केवल इस कॉल को तय करने के लिए उपयोग होती है।",
"ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಈ ಕರೆ ಏರ್ಪಡಿಸಲು ಮಾತ್ರ ಬಳಸಲಾಗುತ್ತದೆ."
],
"Your full name": [
"आपका पूरा नाम",
"ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು"
],
"Your learner profile and active subscription are set up. Appu will now tailor responses and voice explanations specifically for your child.": [
"आपके शिक्षार्थी की प्रोफ़ाइल और सदस्यता तैयार हैं। अब Appu आपके बच्चे के हिसाब से जवाब और आवाज़ में व्याख्या देगा।",
"ನಿಮ್ಮ ಕಲಿಕಾರ್ಥಿ ಪ್ರೊಫೈಲ್ ಮತ್ತು ಚಂದಾದಾರಿಕೆ ಸಿದ್ಧವಾಗಿದೆ. ಇನ್ನು Appu ನಿಮ್ಮ ಮಗುವಿಗೆ ತಕ್ಕಂತೆ ಉತ್ತರ ಮತ್ತು ಧ್ವನಿ ವಿವರಣೆ ನೀಡುತ್ತದೆ."
],
"Your learning mission starts here": [
"आपका सीखने का मिशन यहाँ से शुरू होता है",
"ನಿಮ್ಮ ಕಲಿಕೆಯ ಮಿಷನ್ ಇಲ್ಲಿಂದ ಆರಂಭ"
],
"Your learning support call has been scheduled.": [
"आपकी कॉल तय हो गई है।",
"ನಿಮ್ಮ ಕಲಿಕೆ ಬೆಂಬಲ ಕರೆ ನಿಗದಿಯಾಗಿದೆ."
],
"Your question for Appu": [
"Appu के लिए आपका प्रश्न",
"Appu ಗೆ ನಿಮ್ಮ ಪ್ರಶ್ನೆ"
],
"Your saved study cards, mind maps & revision notes": [
"आपके सहेजे गए स्टडी कार्ड, माइंड मैप और दोहराव नोट्स",
"ನಿಮ್ಮ ಉಳಿಸಿದ ಅಧ್ಯಯನ ಕಾರ್ಡ್‌ಗಳು, ಮೈಂಡ್ ಮ್ಯಾಪ್‌ಗಳು ಮತ್ತು ಪುನರಾವರ್ತನೆ ಟಿಪ್ಪಣಿಗಳು"
],
"and have read our": [
"से सहमत हैं और हमारी",
"ಒಪ್ಪುತ್ತೀರಿ ಮತ್ತು ನಮ್ಮ"
],
"e.g. Aarav": [
"जैसे आरव",
"ಉದಾ. ಆರವ್"
],
"e.g. Shree or Alex": [
"जैसे श्री या एलेक्स",
"ಉದಾ. ಶ್ರೀ ಅಥವಾ ಅಲೆಕ್ಸ್"
],
"e.g. Verma Family": [
"जैसे वर्मा परिवार",
"ಉದಾ. ವರ್ಮಾ ಕುಟುಂಬ"
],
"or": [
"या",
"ಅಥವಾ"
],
"{n} / {n} XP": [
"{n} / {n} XP",
"{n} / {n} XP"
],
"{n} / {n} characters": [
"{n} / {n} अक्षर",
"{n} / {n} ಅಕ್ಷರಗಳು"
],
"{n} Badge": [
"{n} बैज",
"{n} ಬ್ಯಾಡ್ಜ್"
],
"{n} Badges": [
"{n} बैज",
"{n} ಬ್ಯಾಡ್ಜ್‌ಗಳು"
],
"{n} Day": [
"{n} दिन",
"{n} ದಿನ"
],
"{n} Days": [
"{n} दिन",
"{n} ದಿನಗಳು"
],
"{n} Learning Stars! Click to view achievements": [
"{n} सीखने के सितारे! उपलब्धियाँ देखने के लिए क्लिक करें",
"{n} ಕಲಿಕೆಯ ನಕ್ಷತ್ರಗಳು! ಸಾಧನೆಗಳನ್ನು ನೋಡಲು ಕ್ಲಿಕ್ ಮಾಡಿ"
],
"{n} XP": [
"{n} XP",
"{n} XP"
],
"{n} free chats remaining": [
"{n} मुफ़्त चैट बाकी",
"{n} ಉಚಿತ ಚಾಟ್‌ಗಳು ಉಳಿದಿವೆ"
],
"{n} mins": [
"{n} मिनट",
"{n} ನಿಮಿಷ"
],
"{n} minutes of study time has been added. Resuming your lesson now...": [
"{n} मिनट का पढ़ाई समय जोड़ा गया। आपका पाठ फिर शुरू हो रहा है...",
"{n} ನಿಮಿಷಗಳ ಓದುವ ಸಮಯ ಸೇರಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ಪಾಠ ಮುಂದುವರಿಯುತ್ತಿದೆ..."
],
"{n} saved": [
"{n} सहेजे गए",
"{n} ಉಳಿಸಲಾಗಿದೆ"
],
"{n} star": [
"{n} सितारा",
"{n} ನಕ್ಷತ್ರ"
],
"{n} stars": [
"{n} सितारे",
"{n} ನಕ್ಷತ್ರಗಳು"
],
"{n}-day learning streak!": [
"{n}-दिन की सीखने की स्ट्रीक!",
"{n}-ದಿನದ ಕಲಿಕೆಯ ಸ್ಟ್ರೀಕ್!"
],
"© {n} IGR Academy • All rights reserved": [
"© {n} IGR Academy • सर्वाधिकार सुरक्षित",
"© {n} IGR Academy • ಎಲ್ಲ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ"
],
"— by IGr Academy": [
"— IGr Academy द्वारा",
"— IGr Academy ಇಂದ"
],
"🎉 APPU is in Public Beta — Try {n} AI chats free, then sign up to personalise Appu for your child, no card required": [
"🎉 APPU पब्लिक बीटा में है — {n} AI चैट मुफ़्त आज़माएँ, फिर अपने बच्चे के लिए Appu को निजी बनाने हेतु साइन अप करें, कोई कार्ड नहीं चाहिए",
"🎉 APPU ಸಾರ್ವಜನಿಕ ಬೀಟಾದಲ್ಲಿದೆ — {n} AI ಚಾಟ್‌ಗಳನ್ನು ಉಚಿತವಾಗಿ ಪ್ರಯತ್ನಿಸಿ, ನಂತರ ನಿಮ್ಮ ಮಗುವಿಗಾಗಿ Appu ಅನ್ನು ವೈಯಕ್ತೀಕರಿಸಲು ಸೈನ್ ಅಪ್ ಮಾಡಿ, ಕಾರ್ಡ್ ಬೇಕಿಲ್ಲ"
]
};

  const NUM = /\d[\d,]*/g;
  const SKIP = '#landing-view, [id^="landing"], #chat-messages, .msg-bubble, .lesson-card, script, style, noscript, svg, [data-no-translate]';
  const ATTRS = ['placeholder', 'aria-label', 'title'];
  const records = new WeakMap(); // text node -> { src, out }
  let lang = 'en';
  let observer = null;

  function translate(en) {
    const trimmed = en.trim();
    if (!trimmed || (lang !== 'hi' && lang !== 'kn')) return null;
    const entry = DICT[trimmed.replace(NUM, '{n}')];
    const target = entry && entry[lang === 'hi' ? 0 : 1];
    if (!target) return null;
    const nums = trimmed.match(NUM) || [];
    let i = 0;
    const out = target.replace(/\{n\}/g, () => (i < nums.length ? nums[i++] : ''));
    const lead = en.match(/^\s*/)[0];
    const tail = en.match(/\s*$/)[0];
    return lead + out + tail;
  }

  function skipped(el) {
    return !el || (typeof el.closest === 'function' && el.closest(SKIP));
  }

  function doText(node) {
    if (skipped(node.parentElement)) return;
    let rec = records.get(node);
    // App code changed the text since we last touched it: that new text is the source now.
    if (!rec || node.nodeValue !== rec.out) rec = { src: node.nodeValue, out: node.nodeValue };
    const next = lang === 'en' ? rec.src : (translate(rec.src) || rec.src);
    rec.out = next;
    records.set(node, rec);
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function doAttrs(el) {
    if (skipped(el)) return;
    ATTRS.forEach((attr) => {
      if (!el.hasAttribute(attr)) return;
      const cur = el.getAttribute(attr);
      const srcKey = `data-i18n-src-${attr}`;
      const outKey = `data-i18n-out-${attr}`;
      let src = el.getAttribute(srcKey);
      if (src === null || cur !== el.getAttribute(outKey)) src = cur;
      const next = lang === 'en' ? src : (translate(src) || src);
      el.setAttribute(srcKey, src);
      el.setAttribute(outKey, next);
      if (cur !== next) el.setAttribute(attr, next);
    });
  }

  function walk(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === 3) { doText(rootNode); return; }
    if (rootNode.nodeType !== 1 && rootNode.nodeType !== 9) return;
    if (rootNode.nodeType === 1) {
      if (skipped(rootNode)) return;
      doAttrs(rootNode);
    }
    const doc = rootNode.ownerDocument || rootNode;
    const tw = doc.createTreeWalker(rootNode, 1 | 4, {
      acceptNode: (n) => (n.nodeType === 1 && skipped(n) ? 2 : 1)
    });
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) doText(n); else doAttrs(n);
    }
  }

  function startObserver(doc) {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver((mutations) => {
      if (lang === 'en') return;
      mutations.forEach((m) => {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else m.addedNodes.forEach(walk);
      });
    });
    observer.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  const AppuI18n = {
    apply(nextLang, doc = root.document) {
      lang = nextLang === 'hi' || nextLang === 'kn' ? nextLang : 'en';
      if (!doc || !doc.body) return;
      walk(doc.body);
      startObserver(doc);
    },
    translate(text, forLang) {
      const prev = lang;
      lang = forLang || lang;
      try { return translate(String(text || '')) || text; } finally { lang = prev; }
    },
    get language() { return lang; },
    DICT
  };

  root.AppuI18n = AppuI18n;
  if (typeof module !== 'undefined' && module.exports) module.exports = AppuI18n;
})(typeof window !== 'undefined' ? window : globalThis);
