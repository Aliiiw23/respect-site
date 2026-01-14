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

// 🔴 رابط ديسكورد هنا
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1413332579460976783/hOqe3xtgWIFQ9gS_O5khVaEh4vhBiC51Z7hnf7PvV3sf6u5nBTv69eN0_Gens6GuMuKM"; 

// التهيئة
try { firebase.initializeApp(firebaseConfig); } catch(e){ console.error(e); }
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// === مراقبة الدخول ===
auth.onAuthStateChanged(async (user) => {
    document.getElementById('loader').classList.add('hidden');
    if (user) {
        currentUser = user;
        // جلب البيانات الإضافية من قاعدة البيانات لضمان أنها حديثة
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if(userDoc.exists) {
                currentUser.bio = userDoc.data().bio || "";
                // إذا كانت الصورة محفوظة في القاعدة نستخدمها
                if(userDoc.data().photoURL) currentUser.photoURL_db = userDoc.data().photoURL;
            }
        } catch(e) { console.log("New user"); }
        
        showApp();
    } else {
        showAuth();
    }
});

// === التنقل والواجهة ===
function showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
}
function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    updateUI();
    loadPostsRealtime(); // استدعاء البيانات
}
function updateUI() {
    // استخدام الصورة من القاعدة أو من Auth أو الافتراضية
    const pic = currentUser.photoURL_db || currentUser.photoURL || defaultAvatar;
    document.getElementById('header-avatar').src = pic;
    document.getElementById('input-avatar').src = pic;
    document.getElementById('edit-avatar-preview').src = pic;
    document.getElementById('edit-name').value = currentUser.displayName || "";
    document.getElementById('edit-bio').value = currentUser.bio || "";
}

// === تسجيل الدخول ===
function showSignup(){ document.getElementById('login-form').classList.add('hidden'); document.getElementById('signup-form').classList.remove('hidden'); }
function showLogin(){ document.getElementById('signup-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); }

function login() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(e, p).catch(err => alert(err.message));
}
function signup() {
    const n = document.getElementById('signup-name').value;
    const e = document.getElementById('signup-email').value;
    const p = document.getElementById('signup-password').value;
    auth.createUserWithEmailAndPassword(e, p)
        .then(cred => cred.user.updateProfile({displayName: n}))
        .catch(err => alert(err.message));
}
function logout(){ auth.signOut().then(()=>location.reload()); }

// === النشر ===
async function addPost() {
    const text = document.getElementById('tweet-text').value;
    const file = document.getElementById('file-input').files[0];
    const btn = document.getElementById('post-btn');

    if (!text && !file) return;

    btn.disabled = true; // تعطيل الزر لمنع التكرار
    btn.textContent = "جاري النشر...";
    
    let imageUrl = null;
    try {
        if (file) {
            const ref = storage.ref(`posts/${Date.now()}_${file.name}`);
            const task = ref.put(file);
            task.on('state_changed', snap => {
                const per = (snap.bytesTransferred / snap.totalBytes) * 100;
                document.getElementById('upload-bar').style.width = per + "%";
            });
            await task;
            imageUrl = await ref.getDownloadURL();
        }

        // الحفظ في قاعدة البيانات
        const userPic = currentUser.photoURL_db || currentUser.photoURL || defaultAvatar;
        
        await db.collection('posts').add({
            text: text,
            imageUrl: imageUrl,
            authorId: currentUser.uid,
            authorName: currentUser.displayName,
            authorPhoto: userPic,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            likes: [],
            retweets: 0
        });

        // إرسال للديسكورد
        if (DISCORD_WEBHOOK_URL && DISCORD_WEBHOOK_URL.startsWith("http")) {
            const payload = {
                username: "Respect Bot",
                content: `📢 **${currentUser.displayName}:**\n${text}`
            };
            if(imageUrl) payload.embeds = [{image: {url: imageUrl}}];
            fetch(DISCORD_WEBHOOK_URL, {
                method: "POST", headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload)
            });
        }

        // تنظيف الحقول
        document.getElementById('tweet-text').value = "";
        document.getElementById('file-input').value = "";
        document.getElementById('upload-bar').style.width = "0%";
        document.getElementById('file-status').textContent = "";

    } catch (e) {
        alert("حدث خطأ: " + e.message);
    } finally {
        // إعادة تفعيل الزر دائماً سواء نجح أو فشل
        btn.disabled = false;
        btn.textContent = "نشر";
    }
}

// === عرض المنشورات (Realtime) ===
function loadPostsRealtime() {
    db.collection('posts').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const container = document.getElementById('posts-container');
        container.innerHTML = "";
        
        snap.forEach(doc => {
            const p = doc.data();
            const id = doc.id;
            const isLiked = p.likes && p.likes.includes(currentUser.uid);
            const pic = p.authorPhoto || defaultAvatar;
            
            // زر الحذف
            let delBtn = "";
            if(p.authorId === currentUser.uid) {
                delBtn = `<i class="fas fa-trash-alt" style="color:#e0245e; cursor:pointer;" onclick="deletePost('${id}')"></i>`;
            }

            container.innerHTML += `
            <div class="post">
                <img src="${pic}" class="avatar-small">
                <div class="post-content">
                    <div class="post-header">
                        <div class="user-info">
                            <strong>${p.authorName}</strong>
                            <span>@${p.authorName ? p.authorName.replace(/\s/g,'') : 'user'}</span>
                        </div>
                        ${delBtn}
                    </div>
                    <div class="post-text">${p.text}</div>
                    ${p.imageUrl ? `<img src="${p.imageUrl}" class="post-img">` : ''}
                    
                    <div class="post-actions">
                        <div onclick="openComments('${id}')"><i class="far fa-comment"></i></div>
                        <div onclick="retweet('${id}', ${p.retweets || 0})"><i class="fas fa-retweet"></i> <span>${p.retweets||0}</span></div>
                        <div onclick="toggleLike('${id}')" class="${isLiked ? 'liked' : ''}">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> <span>${p.likes ? p.likes.length : 0}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        });
    });
}

// === التفاعلات ===
function toggleLike(id) {
    const ref = db.collection('posts').doc(id);
    ref.get().then(doc => {
        const likes = doc.data().likes || [];
        if (likes.includes(currentUser.uid)) {
            ref.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        } else {
            ref.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
        }
    });
}
function retweet(id, c) { db.collection('posts').doc(id).update({ retweets: c + 1 }); }
function deletePost(id) { if(confirm("حذف؟")) db.collection('posts').doc(id).delete(); }

// === التعليقات والبروفايل ===
let currentPostId = null;
function openComments(id) {
    currentPostId = id;
    document.getElementById('comment-modal').classList.remove('hidden');
    const list = document.getElementById('comments-list');
    list.innerHTML = "جاري التحميل...";
    db.collection('posts').doc(id).collection('comments').orderBy('createdAt').onSnapshot(snap => {
        list.innerHTML = "";
        snap.forEach(d => {
            const c = d.data();
            list.innerHTML += `<div class="comment-item"><strong>${c.author}</strong>: ${c.text}</div>`;
        });
    });
}
function sendComment() {
    const txt = document.getElementById('comment-text').value;
    if(!txt) return;
    db.collection('posts').doc(currentPostId).collection('comments').add({
        text: txt, author: currentUser.displayName, createdAt: new Date()
    });
    document.getElementById('comment-text').value = "";
}

// حفظ البروفايل في قاعدة البيانات
function openProfileModal(){ document.getElementById('profile-modal').classList.remove('hidden'); }
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }

async function saveProfile() {
    const name = document.getElementById('edit-name').value;
    const bio = document.getElementById('edit-bio').value;
    const file = document.getElementById('new-avatar-input').files[0];
    
    let url = currentUser.photoURL_db || currentUser.photoURL;
    if (file) {
        const ref = storage.ref(`avatars/${currentUser.uid}`);
        await ref.put(file);
        url = await ref.getDownloadURL();
    }
    
    // تحديث Auth
    await currentUser.updateProfile({displayName: name, photoURL: url});
    // تحديث قاعدة البيانات (هذا الأهم للحفظ)
    await db.collection('users').doc(currentUser.uid).set({
        displayName: name,
        bio: bio,
        photoURL: url
    }, { merge: true });

    alert("تم الحفظ!");
    location.reload();
}

// عرض اسم الملف المختار
document.getElementById('file-input').onchange = function() {
    if(this.files[0]) document.getElementById('file-status').textContent = "تم اختيار صورة";
};
