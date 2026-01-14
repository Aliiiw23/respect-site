// ================= إعداداتك =================
const firebaseConfig = {
  apiKey: "AIzaSyAX4cGWq8T3vmtOc4zALmlv6WKDEhiwZgY",
  authDomain: "respect-site.firebaseapp.com",
  projectId: "respect-site",
  storageBucket: "respect-site.firebasestorage.app",
  messagingSenderId: "474395406008",
  appId: "1:474395406008:web:40497bb883229964920e4d",
  measurementId: "G-YXB14EJVV0"
};

const DISCORD_WEBHOOK_URL = "ضع_رابط_الويب_هوك_هنا"; 

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// متغيرات عامة
let currentUser = null;
let currentPostIdForComment = null;

// التحقق من المستخدم عند البدء
auth.onAuthStateChanged(async (user) => {
    document.getElementById('loader').classList.add('hidden');
    if (user) {
        currentUser = user;
        // جلب بيانات إضافية (البايو)
        const userDoc = await db.collection('users').doc(user.uid).get();
        currentUser.bio = userDoc.exists ? userDoc.data().bio : "";
        
        showApp();
    } else {
        showAuth();
    }
});

// === دوال الواجهة ===
function showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
}
function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    updateHeader();
    loadPosts();
}
function updateHeader() {
    const avatar = currentUser.photoURL || 'https://via.placeholder.com/40';
    document.getElementById('header-avatar').src = avatar;
    document.getElementById('input-avatar').src = avatar;
    // تحديث بيانات المودال
    document.getElementById('edit-name').value = currentUser.displayName;
    document.getElementById('edit-bio').value = currentUser.bio || "";
    document.getElementById('edit-avatar-preview').src = avatar;
}

// === تسجيل الدخول والخروج ===
function showSignup() { document.getElementById('login-form').classList.add('hidden'); document.getElementById('signup-form').classList.remove('hidden'); }
function showLogin() { document.getElementById('signup-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); }

function login() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(e, p).catch(err => alert(err.message));
}
function signup() {
    const n = document.getElementById('signup-name').value;
    const e = document.getElementById('signup-email').value;
    const p = document.getElementById('signup-password').value;
    auth.createUserWithEmailAndPassword(e, p).then(cred => {
        cred.user.updateProfile({displayName: n}).then(() => location.reload());
    }).catch(err => alert(err.message));
}
function logout() { auth.signOut().then(() => location.reload()); }

// === النشر ===
async function addPost() {
    const text = document.getElementById('tweet-text').value;
    const file = document.getElementById('file-input').files[0];
    const btn = document.getElementById('post-btn');

    if (!text && !file) return;
    btn.disabled = true;
    btn.textContent = "جاري النشر...";

    let imageUrl = null;
    if (file) {
        const ref = storage.ref(`posts/${Date.now()}_${file.name}`);
        const task = ref.put(file);
        task.on('state_changed', 
            (snap) => {
                const per = (snap.bytesTransferred / snap.totalBytes) * 100;
                document.getElementById('upload-bar').style.width = per + "%";
            }
        );
        await task;
        imageUrl = await ref.getDownloadURL();
    }

    // حفظ في Firestore
    await db.collection('posts').add({
        text: text,
        imageUrl: imageUrl,
        authorId: currentUser.uid,
        authorName: currentUser.displayName,
        authorPhoto: currentUser.photoURL,
        likes: [],
        retweets: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // إرسال لديسكورد
    if (DISCORD_WEBHOOK_URL && DISCORD_WEBHOOK_URL.startsWith("http")) {
        const payload = {
            username: "Respect Bot",
            content: `🐦 **تغريدة جديدة من ${currentUser.displayName}:**\n${text}`
        };
        if(imageUrl) payload.embeds = [{image: {url: imageUrl}}];
        fetch(DISCORD_WEBHOOK_URL, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
    }

    // تنظيف
    document.getElementById('tweet-text').value = "";
    document.getElementById('file-input').value = "";
    document.getElementById('upload-bar').style.width = "0%";
    btn.disabled = false;
    btn.textContent = "نشر";
}

// === عرض المنشورات ===
function loadPosts() {
    db.collection('posts').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const container = document.getElementById('posts-container');
        container.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            const id = doc.id;
            const isLiked = p.likes && p.likes.includes(currentUser.uid);
            const likeClass = isLiked ? 'liked' : '';
            const userAvatar = p.authorPhoto || 'https://via.placeholder.com/40';
            
            // زر الحذف (يظهر فقط لصاحب المنشور)
            let deleteBtn = "";
            if(p.authorId === currentUser.uid) {
                deleteBtn = `<i class="fas fa-trash" onclick="deletePost('${id}')" style="color:red; margin-right:auto;"></i>`;
            }

            container.innerHTML += `
            <div class="post">
                <img src="${userAvatar}" class="avatar-small">
                <div class="post-content">
                    <div class="post-header">
                        <strong>${p.authorName}</strong> <span>@${p.authorName.replace(/\s/g, '')}</span>
                        ${deleteBtn}
                    </div>
                    <div class="post-text">${p.text}</div>
                    ${p.imageUrl ? `<img src="${p.imageUrl}" class="post-img">` : ''}
                    
                    <div class="post-actions">
                        <div onclick="openComments('${id}')"><i class="far fa-comment"></i> <span>تعليق</span></div>
                        <div onclick="retweet('${id}', ${p.retweets})" class="${p.retweets > 0 ? 'retweeted' : ''}"><i class="fas fa-retweet"></i> <span>${p.retweets || 0}</span></div>
                        <div onclick="toggleLike('${id}')" class="${likeClass}"><i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> <span>${p.likes ? p.likes.length : 0}</span></div>
                    </div>
                </div>
            </div>`;
        });
    });
}

// === التفاعلات ===
function toggleLike(id) {
    const postRef = db.collection('posts').doc(id);
    postRef.get().then(doc => {
        const likes = doc.data().likes || [];
        if (likes.includes(currentUser.uid)) {
            postRef.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        } else {
            postRef.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
        }
    });
}

function retweet(id, currentCount) {
    // زيادة العداد فقط للتوضيح (الريتويت الحقيقي يتطلب نسخ المنشور)
    db.collection('posts').doc(id).update({ retweets: (currentCount || 0) + 1 });
}

function deletePost(id) {
    if(confirm("هل أنت متأكد من حذف هذا المنشور؟")) {
        db.collection('posts').doc(id).delete();
    }
}

// === التعليقات ===
function openComments(postId) {
    currentPostIdForComment = postId;
    document.getElementById('comment-modal').classList.remove('hidden');
    const list = document.getElementById('comments-list');
    list.innerHTML = "جاري التحميل...";
    
    db.collection('posts').doc(postId).collection('comments').orderBy('createdAt').onSnapshot(snap => {
        list.innerHTML = "";
        if(snap.empty) list.innerHTML = "<p style='text-align:center; color:gray'>لا توجد تعليقات بعد</p>";
        snap.forEach(doc => {
            const c = doc.data();
            list.innerHTML += `<div class="comment-item"><strong>${c.author}</strong>${c.text}</div>`;
        });
    });
}

function sendComment() {
    const text = document.getElementById('comment-text').value;
    if(!text) return;
    db.collection('posts').doc(currentPostIdForComment).collection('comments').add({
        text: text,
        author: currentUser.displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('comment-text').value = "";
}

// === البروفايل والبايو ===
function openProfileModal() { document.getElementById('profile-modal').classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

async function saveProfile() {
    const name = document.getElementById('edit-name').value;
    const bio = document.getElementById('edit-bio').value;
    const file = document.getElementById('new-avatar-input').files[0];

    let photoURL = currentUser.photoURL;

    if (file) {
        const ref = storage.ref(`avatars/${currentUser.uid}`);
        await ref.put(file);
        photoURL = await ref.getDownloadURL();
    }

    // تحديث Auth
    await currentUser.updateProfile({ displayName: name, photoURL: photoURL });
    
    // حفظ البايو في كولكشن المستخدمين
    await db.collection('users').doc(currentUser.uid).set({
        bio: bio,
        photoURL: photoURL,
        displayName: name
    }, { merge: true });

    alert("تم حفظ التغييرات!");
    location.reload();
}
