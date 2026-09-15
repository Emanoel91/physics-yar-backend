# بک‌اند فیزیک‌یار

## چیست
یک سرور Node.js/Express که به دیتابیس PostgreSQL و Object Storage آروان‌کلاد وصل می‌شود و این‌ها را می‌دهد:
- ثبت‌نام و ورود کاربر (`/api/auth`)
- درخت کامل رشته/پایه/فصل/بخش/کلیپ (`GET /api/catalog`)
- لینک امن و موقت دانلود پیش‌نمایش/کلیپ کامل/PDF (`GET /api/clips/:id/download`)
- سبد خرید (`/api/cart`)
- پرداخت با زرین‌پال (`/api/payment`)
- پنل مدیریت کلیپ‌ها (`/api/admin` + فایل `admin/admin.html`)

## نصب روی سرور
```
sudo apt update && sudo apt install -y nodejs npm
node -v   # اگر نسخه خیلی قدیمی بود: sudo apt install -y nodejs npm --fix-missing یا از nodesource استفاده کنید
npm install -g pm2

# کد را روی سرور کپی کنید (با scp یا git)
cd physics-yar-backend
npm install
cp .env.example .env
nano .env   # مقادیر واقعی را وارد کنید
```

## ساخت جدول‌های دیتابیس
از کامپیوتر خودتان (یا سرور)، با `psql` به دیتابیس وصل شوید و schema.sql را اجرا کنید:
```
psql "postgresql://base-user:PASSWORD@HOST:5432/postgres?sslmode=require" -f sql/schema.sql
```

## اجرای سرور
```
pm2 start src/index.js --name physics-yar-backend
pm2 save
pm2 startup   # دستوری که نشان می‌دهد را اجرا کنید تا بعد از ریبوت هم بالا بیاید
```

سرور روی پورت داخلی 4000 بالا می‌آید. برای در دسترس بودن روی اینترنت با HTTPS (که برای اپ گیت‌هاب‌پیجزی الزامی است چون آن HTTPS است)، یک Nginx reverse proxy با گواهی SSL رایگان (Let's Encrypt / certbot) روی همین سرور جلوی آن قرار می‌گیرد. این را در گام بعدی با هم انجام می‌دهیم.

## ساخت اولین مدیر (Admin)
۱. یک کاربر عادی بسازید (با curl یا از طریق اپ):
```
curl -X POST https://YOUR-DOMAIN/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"مدیر فیزیک‌یار","phone":"0912xxxxxxx","password":"یک-رمز-قوی"}'
```
۲. آن کاربر را در دیتابیس ادمین کنید:
```
psql "postgresql://base-user:PASSWORD@HOST:5432/postgres?sslmode=require" \
  -c "UPDATE users SET is_admin=true WHERE phone='0912xxxxxxx';"
```
۳. حالا با همین شماره و رمز می‌توانید وارد `admin.html` شوید.

## پنل مدیریت (admin.html)
فایل `admin/admin.html` را جایی که به آدرس HTTPS بک‌اند دسترسی دارد میزبانی کنید (می‌تواند همان ریپازیتوری گیت‌هاب‌پیجز باشد). پیش از استفاده، مقدار `API_BASE` در بالای فایل را به آدرس واقعی بک‌اندتان تغییر دهید.
