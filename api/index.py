from flask import Flask, render_template, request, jsonify, session, redirect
from pymongo import MongoClient
import re
import random
import string

app = Flask(__name__, template_folder='../templates')
app.secret_key = "DR_SELEM_VIP_SECURE_2026"

# اتصال قاعدة البيانات
MONGO_URI = "mongodb+srv://admin:admin1312312313@aws.rhgcybe.mongodb.net/?appName=aws"
client = MongoClient(MONGO_URI)
db = client['university_system']

users_col = db['users']
subjects_col = db['subjects']
committees_col = db['committees']
complaints_col = db['complaints']
settings_col = db['settings']

# [الحل الجذري]: تحديث إجباري لحساب الآدمن الرئيسي لضمان مسح الباسورد القديم
users_col.update_one(
    {"role": "super_admin"},
    {"$set": {
        "username": "|ًٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌُ Nًًًًٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌُُُُexusًٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌٌُ ًًًٌٌٌُُُ|ًًًًًًًًًًًًًًًًًً|ًًًََََُُُُ 2ًًًًًًًًًًًًًًًًًًًًًًًًًًًٌٌٌُُُ026ًًًًًًًًًًًًًًًًًًًًًًًًًًًًً|!@#$@#$", 
        "password": "Nexus@Aًًٌٌُُhmًًٌٌُُed@Aًًٌٌُُdmًًٌٌٌُُin202ًًًٌٌٌُُُ6!#|\ًًٌٌُُ!#OIًًٌٌُ", 
        "name": "Nexus"
    }},
    upsert=True
)

if not settings_col.find_one({"type": "system_status"}):
    settings_col.insert_one({"type": "system_status", "is_open": True})

def check_system_open():
    status = settings_col.find_one({"type": "system_status"})
    return status.get('is_open', True) if status else True

def generate_tracking_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

@app.route('/')
def index():
    if not check_system_open():
        return """<!doctype html><html lang=en><title>404 Not Found</title><h1>Not Found</h1><p>The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again.</p></html>""", 404
    return render_template('index.html')

@app.route('/api/get-subjects')
def get_subjects():
    if not check_system_open(): return jsonify({"status": "error", "message": "System Closed"}), 403
    subjects = list(subjects_col.find({}, {"_id": 0}))
    return jsonify({"subjects": subjects})

@app.route('/api/check-id', methods=['POST'])
def check_id():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    data = request.json
    subject_id = data.get('subject_id')
    student_id = str(data.get('student_id')).strip()
    
    if len(student_id) != 7 or not student_id.isdigit():
        return jsonify({"status": "error", "message": "رقم الـ ID يجب أن يكون 7 أرقام فقط"}), 400
        
    committee = committees_col.find_one({"subject_id": subject_id, "ids": student_id})
    if committee:
        return jsonify({"status": "success", "committee_name": committee['committee_name']})
    else:
        return jsonify({"status": "error", "message": "لم يتم العثور على هذا الـ ID في هذه المادة. تأكد من الرقم."})

@app.route('/api/submit-complaint', methods=['POST'])
def submit_complaint():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    data = request.json
    
    subject = subjects_col.find_one({"id": data['subject_id']})
    if subject and not subject.get('complaints_open', True):
        return jsonify({"status": "error", "message": "عفواً، تم إغلاق باب استقبال الشكاوى لهذه المادة من قبل دكتور المادة."}), 403

    tracking_id = generate_tracking_id()
    
    complaints_col.insert_one({
        "tracking_id": tracking_id,
        "subject_id": data['subject_id'],
        "subject_name": data['subject_name'],
        "student_id": data['student_id'],
        "student_name": data['student_name'],
        "assigned_committee": data['assigned_committee'],
        "actual_committee": data['actual_committee'],
        "problem": data['problem'][:150], 
        "status": "pending",
        "admin_reply": ""
    })
    return jsonify({"status": "success", "tracking_id": tracking_id})

@app.route('/api/track-complaint', methods=['POST'])
def track_complaint():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    tracking_id = request.json.get('tracking_id').strip().upper()
    complaint = complaints_col.find_one({"tracking_id": tracking_id}, {"_id": 0})
    if complaint: return jsonify({"status": "success", "complaint": complaint})
    return jsonify({"status": "error", "message": "رقم التتبع غير صحيح أو غير موجود."})

@app.route('/auth-gateway-vip-x9v2-pL7q-2026', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        user = users_col.find_one({"username": request.json.get('username'), "password": request.json.get('password')})
        if user:
            session['admin'] = {"username": user['username'], "role": user['role'], "name": user['name']}
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "بيانات الدخول غير صحيحة"}), 401
    return render_template('admin.html')

@app.route('/logout-gateway-vip-x9v2-pL7q-2026')
def logout():
    session.clear()
    return redirect('/auth-gateway-vip-x9v2-pL7q-2026')

@app.route('/api/admin-data')
def get_admin_data():
    if 'admin' not in session: return jsonify({"status": "unauthorized"}), 401
    
    curr_user = users_col.find_one({"username": session['admin']['username']})
    user_role = curr_user.get('role')
    
    if user_role == 'super_admin':
        subjects = list(subjects_col.find({}, {"_id": 0}))
        committees = list(committees_col.find({}, {"_id": 0}))
        complaints = list(complaints_col.find({}, {"_id": 0}))
        staff = list(users_col.find({"role": {"$ne": "super_admin"}}, {"_id": 0}))
    else:
        allowed_subs = curr_user.get('allowed_subjects', [])
        subjects = list(subjects_col.find({"id": {"$in": allowed_subs}}, {"_id": 0}))
        committees = list(committees_col.find({"subject_id": {"$in": allowed_subs}}, {"_id": 0}))
        complaints = list(complaints_col.find({"subject_id": {"$in": allowed_subs}}, {"_id": 0}))
        
        if user_role == 'doctor':
            staff = list(users_col.find({"created_by": curr_user['username']}, {"_id": 0}))
        else:
            staff = []

    system_open = check_system_open()
    
    return jsonify({
        "subjects": subjects, 
        "committees": committees, 
        "staff": staff, 
        "complaints": complaints, 
        "currentAdmin": session['admin'],
        "system_open": system_open
    })

@app.route('/api/admin-action', methods=['POST'])
def admin_action():
    if 'admin' not in session: return jsonify({"status": "unauthorized"}), 403
    
    data = request.json
    action = data.get('action')
    curr = session['admin']
    curr_db = users_col.find_one({"username": curr['username']})
    role = curr_db.get('role')
    
    if action == 'toggle_system' and role == 'super_admin':
        settings_col.update_one({"type": "system_status"}, {"$set": {"is_open": data['is_open']}})
        return jsonify({"status": "success"})

    elif action == 'toggle_subject_complaints':
        if role == 'ta': 
            return jsonify({"status": "error", "message": "غير مصرح للمعيدين بإيقاف استقبال الشكاوى!"}), 403
            
        if role == 'doctor' and data['subject_id'] not in curr_db.get('allowed_subjects', []):
            return jsonify({"status": "error", "message": "غير مصرح لك بتعديل هذه المادة!"}), 403

        subjects_col.update_one({"id": data['subject_id']}, {"$set": {"complaints_open": data['is_open']}})
        return jsonify({"status": "success"})

    elif action == 'change_my_password':
        users_col.update_one({"username": curr['username']}, {"$set": {"password": data['new_password']}})
        return jsonify({"status": "success"})

    elif action == 'change_password':
        target_user = data.get('target_user')
        new_password = data.get('new_password')
        
        target_db = users_col.find_one({"username": target_user})
        if role != 'super_admin' and target_db.get('created_by') != curr['username']:
            return jsonify({"status": "error", "message": "غير مصرح لك بتغيير كلمة مرور هذا المستخدم!"}), 403
            
        users_col.update_one({"username": target_user}, {"$set": {"password": new_password}})
        return jsonify({"status": "success"})

    elif action == 'manage_subject':
        if role != 'super_admin':
            return jsonify({"status": "error", "message": "غير مصرح لك بإدارة المواد!"}), 403
            
        if data['sub'] == 'add': subjects_col.insert_one({**data['subject'], "added_by": curr['name']})
        elif data['sub'] == 'delete':
            subjects_col.delete_one({"id": data['id']})
            committees_col.delete_many({"subject_id": data['id']})
            
    elif action == 'manage_committee':
        if data['sub'] == 'add':
            clean_ids = list(set(re.findall(r'\b\d{7}\b', data['committee']['raw_ids'])))
            committees_col.insert_one({
                "committee_id": "COM_" + str(len(clean_ids)) + "_" + data['committee']['subject_id'],
                "subject_id": data['committee']['subject_id'],
                "committee_name": data['committee']['name'],
                "ids": clean_ids, "added_by": curr['name']
            })
        elif data['sub'] == 'delete': committees_col.delete_one({"committee_id": data['id']})

    # ------------------ الأوامر الجديدة لمسح اللجان والشكاوى للمادة ------------------
    elif action == 'wipe_subject_committees':
        if role != 'super_admin': 
            return jsonify({"status": "error", "message": "غير مصرح لك بمسح اللجان!"}), 403
        committees_col.delete_many({"subject_id": data['subject_id']})
        return jsonify({"status": "success"})

    elif action == 'wipe_subject_complaints':
        if role != 'super_admin': 
            return jsonify({"status": "error", "message": "غير مصرح لك بمسح الشكاوى!"}), 403
        complaints_col.delete_many({"subject_id": data['subject_id'], "status": data['status']})
        return jsonify({"status": "success"})
    # ----------------------------------------------------------------------------------

    elif action == 'manage_staff':
        if role == 'ta': return jsonify({"status": "error", "message": "المعيد ليس له صلاحية إدارة طاقم"}), 403
        
        if data['sub'] == 'add':
            new_role = data['staff'].get('role', 'ta')
            allowed_subs = data['staff'].get('allowed_subjects', [])
            
            if role == 'doctor':
                new_role = 'ta'
                my_subs = curr_db.get('allowed_subjects', [])
                if not all(s in my_subs for s in allowed_subs):
                    return jsonify({"status": "error", "message": "لا يمكنك إعطاء صلاحية لمعيد في مادة لا تدرسها أنت!"}), 403
                    
            if not users_col.find_one({"username": data['staff']['username']}): 
                users_col.insert_one({
                    "name": data['staff']['name'],
                    "username": data['staff']['username'],
                    "password": data['staff']['password'],
                    "role": new_role,
                    "allowed_subjects": allowed_subs,
                    "created_by": curr['username']
                })
            else: return jsonify({"status": "error", "message": "اسم المستخدم موجود بالفعل!"}), 400
            
        elif data['sub'] == 'edit':
            target_username = data.get('old_username')
            new_data = data['staff']
            target = users_col.find_one({"username": target_username})
            
            if not target: return jsonify({"status": "error", "message": "المستخدم غير موجود!"}), 404
            
            if role == 'doctor' and target.get('created_by') != curr['username']:
                return jsonify({"status": "error", "message": "غير مصرح لك بتعديل هذا المستخدم!"}), 403
                
            new_role = new_data.get('role', target.get('role'))
            allowed_subs = new_data.get('allowed_subjects', target.get('allowed_subjects', []))
            
            if role == 'doctor':
                new_role = 'ta'
                my_subs = curr_db.get('allowed_subjects', [])
                if not all(s in my_subs for s in allowed_subs):
                    return jsonify({"status": "error", "message": "لا يمكنك إعطاء صلاحية لمعيد في مادة لا تدرسها أنت!"}), 403

            if new_data['username'] != target_username and users_col.find_one({"username": new_data['username']}):
                return jsonify({"status": "error", "message": "اسم المستخدم الجديد مستخدم بالفعل!"}), 400

            old_name = target.get('name')
            new_name = new_data.get('name')

            update_fields = {
                "name": new_name,
                "username": new_data['username'],
                "role": new_role,
                "allowed_subjects": allowed_subs
            }
            if new_data.get('password') and new_data['password'].strip() != '':
                update_fields['password'] = new_data['password']

            users_col.update_one({"username": target_username}, {"$set": update_fields})

            if old_name != new_name:
                subjects_col.update_many({"added_by": old_name}, {"$set": {"added_by": new_name}})
                committees_col.update_many({"added_by": old_name}, {"$set": {"added_by": new_name}})
                complaints_col.update_many({"replied_by": old_name}, {"$set": {"replied_by": new_name}})
                
            if target_username != new_data['username']:
                users_col.update_many({"created_by": target_username}, {"$set": {"created_by": new_data['username']}})
                if target_username == curr['username']:
                    session['admin']['username'] = new_data['username']
            
            if old_name != new_name and target_username == curr['username']:
                 session['admin']['name'] = new_name

        elif data['sub'] == 'delete': 
            target = users_col.find_one({"username": data['username']})
            if role == 'doctor' and target.get('created_by') != curr['username']:
                return jsonify({"status": "error", "message": "لا يمكنك حذف معيد لا يتبعك!"}), 403
            users_col.delete_one({"username": data['username']})
            
    elif action == 'reply_complaint':
        complaints_col.update_one({"tracking_id": data['tracking_id']}, {"$set": {"status": "resolved", "admin_reply": data['reply'], "replied_by": curr['name']}})
    elif action == 'mark_spam':
        complaints_col.update_one({"tracking_id": data['tracking_id']}, {"$set": {"status": "spam"}})
    elif action == 'restore_complaint':
        complaints_col.update_one({"tracking_id": data['tracking_id']}, {"$set": {"status": "pending"}})
    elif action == 'delete_complaint':
        complaints_col.delete_one({"tracking_id": data['tracking_id']})
        
    elif action == 'wipe_all' and role == 'super_admin':
        admin_user = users_col.find_one({"username": curr['username']})
        if admin_user and admin_user.get('password') == data.get('admin_password'):
            subjects_col.delete_many({})
            committees_col.delete_many({})
            complaints_col.delete_many({})
            return jsonify({"status": "success", "message": "تم تدمير جميع بيانات النظام بنجاح"})
        else:
            return jsonify({"status": "error", "message": "كلمة المرور غير صحيحة، تم إحباط العملية"}), 401
            
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(port=8080)
