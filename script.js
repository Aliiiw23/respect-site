// ================= إعدادات Firebase (الخاصة بك) =================
const firebaseConfig = {
  apiKey: "AIzaSyAX4cGWq8T3vmtOc4zALmlv6WKDEhiwZgY",
  authDomain: "respect-site.firebaseapp.com",
  projectId: "respect-site",
  storageBucket: "respect-site.firebasestorage.app",
  messagingSenderId: "474395406008",
  appId: "1:474395406008:web:40497bb883229964920e4d",
  measurementId: "G-YXB14EJVV0"
};

// تهيئة Firebase (باستخدام مكتبات Compat المتوافقة مع HTML)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ================= المتغيرات وعناصر HTML =================
// حاويات الشاشات
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

// عناصر تسجيل الدخول
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');

// عناصر التطبيق
const tweetInput = document.getElementById('tweetInput');
const tweetBtn = document.getElementById('tweetBtn');
const feedContainer = document.getElementById('feedContainer');
const currentUserSpan = document.getElementById('current-user-name');
const imageInput = document.getElementById('imageInput');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const fileNameSpan = document.getElementById('fileName');

// رابط الديسكورد (اختياري - ضعه إذا أردت استمراره)
const DISCORD_WEBHOOK_URL = ""; 


// ================= أولاً: مراقبة حالة المستخدم (هل هو مسجل دخول؟) =================
auth.onAuthStateChanged(user => {
    if (user) {
        // المستخدم مسجل دخول -> أظهر التطبيق وأخفِ شاشة الدخول
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        currentUserSpan.textContent = user.displayName || user.email; // عرض الاسم
        
        // بدء الاستماع للمنشورات
        loadPostsRealtime();
    } else {
        // المستخدم غير مسجل -> أظهر شاشة الدخول وأخفِ التطبيق
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        feedContainer.innerHTML = ''; // تنظيف المنشورات
    }
});


// ================= ثانياً: وظائف تسجيل الدخول والخروج =================

// التبديل بين فورم الدخول وإنشاء الحساب
showSignupBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});
showLoginBtn.addEventListener('click', () => {
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// إنشاء حساب جديد
signupBtn.addEventListener('click', () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const username = document.getElementById('signup-username').value;

    if(!email || !password || !username) { alert("يرجى ملء كل الحقول"); return; }

    auth.createUserWithEmailAndPassword(email, password)
        .then(cred => {
            // إضافة اسم المستخدم للملف الشخصي
            return cred.user.updateProfile({ displayName: username });
        })
        .catch(err => alert("خطأ في الإنشاء: " + err.message));
});

// تسجيل الدخول
loginBtn.addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(err => alert("خطأ في الدخول: " + err.message));
});

// تسجيل الخروج
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});


// ================= ثالثاً: وظائف النشر ورفع الصور =================

// إظهار اسم الملف المختار
imageInput.addEventListener('change', function() {
    if(this.files[0]) {
        fileNameSpan.textContent = this.files[0].name;
    }
});

tweetBtn.addEventListener('click', async () => {
    const text = tweetInput.value;
    const imageFile = imageInput.files[0];
    const user = auth.currentUser;

    if ((text.trim() === "" && !imageFile) || !user) {
        alert("اكتب شيئاً أو اختر صورة للنشر!");
        return;
    }

    // تعطيل الزر أثناء النشر
    tweetBtn.disabled = true;
    tweetBtn.textContent = "جاري النشر...";

    let imageUrl = null;

    try {
        // 1. إذا توجد صورة، ارفعها أولاً
        if (imageFile) {
            // اسم فريد للصورة باستخدام الوقت
            const storageRef = storage.ref(`posts/${Date.now()}_${imageFile.name}`);
            const uploadTask = storageRef.put(imageFile);

            // انتظار اكتمال الرفع والحصول على الرابط
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot) => {
                        // تحديث شريط التقدم
                        let progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        uploadProgressBar.style.width = progress + '%';
                    },
                    (error) => reject(error),
                    () => {
                        uploadTask.snapshot.ref.getDownloadURL().then(url => {
                            imageUrl = url;
                            resolve();
                        });
                    }
                );
            });
        }

        // 2. حفظ بيانات المنشور في قاعدة البيانات Firestore
        await db.collection('posts').add({
            text: text,
            imageUrl: imageUrl,
            authorName: user.displayName,
            authorId: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp() // وقت السيرفر
        });

        // 3. إرسال للديسكورد (اختياري)
        if(DISCORD_WEBHOOK_URL && text) {
             fetch(DISCORD_WEBHOOK_URL, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ content: `👤 **${user.displayName}:** ${text}` })
             });
        }

        // تنظيف الحقول بعد النجاح
        tweetInput.value = "";
        imageInput.value = "";
        fileNameSpan.textContent = "";
        uploadProgressBar.style.width = "0%";

    } catch (error) {
        console.error("Error adding post: ", error);
        alert("حدث خطأ أثناء النشر!");
    } finally {
        // إعادة تفعيل الزر
        tweetBtn.disabled = false;
        tweetBtn.textContent = "نشر";
    }
});


// ================= رابعاً: جلب المنشورات وعرضها (Realtime) =================
function loadPostsRealtime() {
    // الاستماع لأي تغيير في مجموعة 'posts' وترتيبها حسب الوقت
    db.collection('posts').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        feedContainer.innerHTML = ''; // مسح القائمة القديمة

        snapshot.forEach(doc => {
            const post = doc.data();
            showPostInFeed(post);
        });
    });
}

// دالة مساعدة لرسم المنشور في HTML
function showPostInFeed(post) {
    const postDiv = document.createElement('div');
    postDiv.classList.add('post');

    // تحويل وقت فايربيس لوقت مقروء
    let timeString = "";
    if(post.createdAt) {
        timeString = new Date(post.createdAt.toDate()).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'});
    }

    // تجهيز HTML الصورة إذا وجدت
    let imageHTML = "";
    if(post.imageUrl) {
        imageHTML = `<img src="${post.imageUrl}" class="post-image" alt="post image">`;
    }

    postDiv.innerHTML = `
        <div class="post-avatar"><i class="fas fa-user-circle"></i></div>
        <div class="post-body">
            <div class="post-header">
                <span class="username">${post.authorName}</span>
                <span class="time">. ${timeString}</span>
            </div>
            <div class="post-content">
                <p>${post.text}</p>
                ${imageHTML} </div>
        </div>
    `;
    feedContainer.appendChild(postDiv);
}
