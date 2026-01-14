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

// تهيئة Firebase بأمان
try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Firebase Init Error", e);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let currentPostId = null;

// مراقبة الدخول
auth.onAuthStateChanged(async (user) => {
    document.getElementById('loader').classList.add('hidden'); // إخفاء التحميل
    if (user) {
        currentUser = user;
        // جلب البايو
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if(doc.exists) currentUser.bio = doc.data().bio;
        } catch(e) { console.log("No bio yet"); }
        
        showApp();
    } else {
        showAuth();
    }
});

// دوال التنقل
function showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
}
function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    updateUI();
    loadPosts();
}
function updateUI() {
    const avatar = currentUser.photoURL || 'https://via.placeholder.com/40';
    document.getElementById('header-avatar').src = avatar;
    document.getElementById('input-avatar').src = avatar;
    document.getElementById('edit-avatar-preview').src = avatar;
    document.getElementById('edit-name').value = currentUser.displayName || "";
    document.getElementById('edit-bio').value = currentUser.bio || "";
}

// تسجيل الدخول
function showSignup() { 
    document.getElementById('login-form').classList.add('hidden'); 
    document.getElementById('signup-form').classList.remove('hidden'); 
}
function showLogin() { 
    document.getElementById('signup-form').classList.add('hidden'); 
    document.getElementById('login-form').classList.remove('hidden'); 
}

function login() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(e, p).catch(err => alert("خطأ: " + err.message));
}
function signup() {
    const n = document.getElementById('signup-name').value;
    const e = document.getElementById('signup-email').value;
    const p = document.getElementById('signup-password').value;
    auth.createUserWithEmailAndPassword(e, p)
        .then(cred => cred.user.updateProfile({displayName: n}))
        .catch(err => alert("خطأ: " + err.message));
}
function logout() { auth.signOut().then(() => location.reload()); }

// النشر
async function addPost() {
    const text = document.getElementById('tweet-text').value;
    const file = document.getElementById('file-input').files[0];
    const btn = document.getElementById('post-btn');

    if (!text && !file) return;

    btn.disabled = true;
    btn.textContent = "...";
    
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

        await db.collection('posts').add({
            text: text,
            imageUrl: imageUrl,
            authorId: currentUser.uid,
            authorName: currentUser.displayName,
            authorPhoto: currentUser.photoURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            likes: [],
            retweets: 0
        });

        // ديسكورد
        if (DISCORD_WEBHOOK_URL.startsWith("http")) {
            const payload = {
                username: "Respect Bot",
                content: `🟣 **${currentUser.displayName}:**\n${text}`
            };
            if(imageUrl) payload.embeds = [{image: {url: imageUrl}}];
            fetch(DISCORD_WEBHOOK_URL, {
                method: "POST", headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload)
            });
        }

        // تنظيف
        document.getElementById('tweet-text').value = "";
        document.getElementById('file-input').value = "";
        document.getElementById('upload-bar').style.width = "0%";

    } catch (e) {
        alert("فشل النشر: " + e.message);
    }
    btn.disabled = false;
    btn.textContent = "نشر";
}

// عرض المنشورات
function loadPosts() {
    db.collection('posts').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const container = document.getElementById('posts-container');
        container.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            const id = doc.id;
            const isLiked = p.likes && p.likes.includes(currentUser.uid);
            const userImg = p.authorPhoto || 'https://via.placeholder.com/40';
            
            // زر الحذف
            let delBtn = "";
            if (p.authorId === currentUser.uid) {
                delBtn = `<i class="fas fa-trash" style="color:red; margin-right:auto; cursor:pointer;" onclick="deletePost('${id}')"></i>`;
            }

            container.innerHTML += `
            <div class="post">
                <img src="${userImg}" class="avatar-small">
                <div class="post-content">
                    <div class="post-header">
                        <strong>${p.authorName}</strong> <span>@${p.authorName.replace(/\s/g,'')}</span>
                        ${delBtn}
                    </div>
                    <div class="post-text">${p.text}</div>
                    ${p.imageUrl ? `<img src="${p.imageUrl}" class="post-img">` : ''}
                    <div class="post-actions">
                        <div onclick="openComments('${id}')"><i class="far fa-comment"></i></div>
                        <div onclick="retweet('${id}', ${p.retweets || 0})" class="${p.retweets > 0 ? 'retweeted' : ''}">
                            <i class="fas fa-retweet"></i> <span>${p.retweets || 0}</span>
                        </div>
                        <div onclick="toggleLike('${id}')" class="${isLiked ? 'liked' : ''}">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> <span>${p.likes ? p.likes.length : 0}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        });
    });
}

// التفاعلات
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
function retweet(id, count) {
    db.collection('posts').doc(id).update({ retweets: count + 1 });
}
function deletePost(id) {
    if(confirm("حذف المنشور؟")) db.collection('posts').doc(id).delete();
}

// التعليقات
function openComments(id) {
    currentPostId = id;
    document.getElementById('comment-modal').classList.remove('hidden');
    const list = document.getElementById('comments-list');
    list.innerHTML = "loading...";
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

// البروفايل
function openProfileModal() { document.getElementById('profile-modal').classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

async function saveProfile() {
    const name = document.getElementById('edit-name').value;
    const bio = document.getElementById('edit-bio').value;
    const file = document.getElementById('new-avatar-input').files[0];
    
    let url = currentUser.photoURL;
    if (file) {
        const ref = storage.ref(`avatars/${currentUser.uid}`);
        await ref.put(file);
        url = await ref.getDownloadURL();
    }
    
    await currentUser.updateProfile({displayName: name, photoURL: url});
    await db.collection('users').doc(currentUser.uid).set({bio: bio, photoURL: url, displayName: name}, {merge:true});
    location.reload();
}
