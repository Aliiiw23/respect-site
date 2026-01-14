// ================= إعدادات Firebase =================
const firebaseConfig = {
  apiKey: "AIzaSyAX4cGWq8T3vmtOc4zALmlv6WKDEhiwZgY",
  authDomain: "respect-site.firebaseapp.com",
  projectId: "respect-site",
  storageBucket: "respect-site.firebasestorage.app",
  messagingSenderId: "474395406008",
  appId: "1:474395406008:web:40497bb883229964920e4d",
  measurementId: "G-YXB14EJVV0"
};

// ================= رابط الديسكورد (WEBHOOK) =================
// 🔴 استبدل الرابط أدناه برابط الويب هوك الخاص بروم الديسكورد 🔴
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1413332579460976783/hOqe3xtgWIFQ9gS_O5khVaEh4vhBiC51Z7hnf7PvV3sf6u5nBTv69eN0_Gens6GuMuKM"; 


firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// العناصر
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const tweetInput = document.getElementById('tweetInput');
const tweetBtn = document.getElementById('tweetBtn');
const imageInput = document.getElementById('imageInput');
const fileNameSpan = document.getElementById('fileName');

// مراقبة الدخول
auth.onAuthStateChanged(user => {
    if (user) {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        document.getElementById('current-user-name').textContent = user.displayName;
        loadPosts();
    } else {
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
    }
});

// أزرار التبديل والخروج
document.getElementById('show-signup').onclick = () => { loginForm.classList.add('hidden'); signupForm.classList.remove('hidden'); };
document.getElementById('show-login').onclick = () => { signupForm.classList.add('hidden'); loginForm.classList.remove('hidden'); };
document.getElementById('logout-btn').onclick = () => auth.signOut();

// تسجيل دخول وإنشاء حساب
document.getElementById('signup-btn').onclick = () => {
    const u = document.getElementById('signup-username').value;
    const e = document.getElementById('signup-email').value;
    const p = document.getElementById('signup-password').value;
    auth.createUserWithEmailAndPassword(e, p).then(c => c.user.updateProfile({displayName: u})).catch(e => alert(e.message));
};

document.getElementById('login-btn').onclick = () => {
    auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value).catch(e => alert(e.message));
};

// اختيار صورة
imageInput.onchange = function() { if(this.files[0]) fileNameSpan.textContent = "تم اختيار صورة"; };

// === عملية النشر وإرسال للديسكورد ===
tweetBtn.onclick = async () => {
    const text = tweetInput.value;
    const file = imageInput.files[0];
    const user = auth.currentUser;

    if ((!text && !file) || !user) return;

    tweetBtn.disabled = true;
    tweetBtn.textContent = "جاري النشر...";
    let imageUrl = null;

    try {
        // 1. رفع الصورة لفايربيس
        if (file) {
            const ref = storage.ref(`posts/${Date.now()}_${file.name}`);
            await ref.put(file);
            imageUrl = await ref.getDownloadURL();
        }

        // 2. الحفظ في الموقع
        await db.collection('posts').add({
            text: text,
            imageUrl: imageUrl,
            author: user.displayName,
            date: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. الإرسال إلى ديسكورد
        if (DISCORD_WEBHOOK_URL !== "ضع_رابط_الويب_هوك_هنا") {
            const discordPayload = {
                username: "Respect Bot",
                content: `📢 **منشور جديد من ${user.displayName}:**\n${text}`,
            };
            // إذا توجد صورة نرفقها
            if (imageUrl) {
                discordPayload.embeds = [{ image: { url: imageUrl } }];
            }

            fetch(DISCORD_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(discordPayload)
            });
        }

        // تنظيف
        tweetInput.value = "";
        imageInput.value = "";
        fileNameSpan.textContent = "";

    } catch (err) {
        alert("خطأ: " + err.message);
    }
    tweetBtn.disabled = false;
    tweetBtn.textContent = "نشر";
};

// عرض المنشورات
function loadPosts() {
    db.collection('posts').orderBy('date', 'desc').onSnapshot(snap => {
        const container = document.getElementById('feedContainer');
        container.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            const imgHtml = p.imageUrl ? `<img src="${p.imageUrl}" class="post-image">` : '';
            container.innerHTML += `
                <div class="post">
                    <div class="post-body">
                        <div class="post-header"><strong>${p.author}</strong> <span class="time">. الآن</span></div>
                        <p>${p.text}</p>
                        ${imgHtml}
                    </div>
                </div>`;
        });
    });
}
