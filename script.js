const tweetInput = document.getElementById('tweetInput');
const tweetBtn = document.getElementById('tweetBtn');
const feedContainer = document.getElementById('feedContainer');

tweetBtn.addEventListener('click', () => {
    const text = tweetInput.value;

    if (text.trim() === "") {
        alert("الرجاء كتابة شيء للنشر!");
        return;
    }

    // إنشاء عنصر المنشور الجديد
    const postDiv = document.createElement('div');
    postDiv.classList.add('post');

    postDiv.innerHTML = `
        <div class="post-avatar">
            <i class="fas fa-user-circle"></i>
        </div>
        <div class="post-body">
            <div class="post-header">
                <span class="username">مستخدم جديد</span>
                <span class="handle">@user_respect</span>
                <span class="time">. الآن</span>
            </div>
            <div class="post-content">
                <p>${text}</p>
            </div>
            <div class="post-footer">
                <div class="action"><i class="far fa-comment"></i> <span>0</span></div>
                <div class="action"><i class="fas fa-retweet"></i> <span>0</span></div>
                <div class="action"><i class="far fa-heart"></i> <span>0</span></div>
            </div>
        </div>
    `;

    // إضافة المنشور في أعلى القائمة
    feedContainer.prepend(postDiv);

    // تفريغ الحقل
    tweetInput.value = "";
});

// السماح بالنشر عبر زر Enter
tweetInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        tweetBtn.click();
    }
});
