# This is the script used earlier to verify that all the changes
# for the Razorpay integration and UI updates were applied successfully.

import sys
sys.stdout.reconfigure(encoding='utf-8')

def check(name, content, token):
    found = token in content
    print(f'  [{"OK" if found else "FAIL"}] {name}')

# index.html
with open(r'c:\Users\prasanth\OneDrive\Desktop\PRASANTH projects\clg canteen\index.html', 'rb') as f:
    idx = f.read().decode('utf-8')

print('=== index.html ===')
check('Razorpay script', idx, 'checkout.razorpay.com')
check('Payment Method label', idx, 'Payment Method')
check('UPI option', idx, 'value="upi"')
check('Card option', idx, 'value="card"')
check('Net Banking', idx, 'value="netbanking"')
check('Cash on Pickup', idx, 'value="cash"')
check('Pay & Place Order btn', idx, 'Place Order')

# app.js
with open(r'c:\Users\prasanth\OneDrive\Desktop\PRASANTH projects\clg canteen\app.js', 'rb') as f:
    app = f.read().decode('utf-8')

print('\n=== app.js ===')
check('RAZORPAY_KEY_ID', app, 'RAZORPAY_KEY_ID')
check('placeOnlineOrder', app, 'placeOnlineOrder')
check('placeCashOrder', app, 'placeCashOrder')
check('getSelectedPaymentMethod', app, 'getSelectedPaymentMethod')
check('deductStock', app, 'deductStock')
check('stock-few badge', app, 'stock-few')
check('orange stock (<=2)', app, 'stock <= 2')
check('window.Razorpay', app, 'window.Razorpay')

# order-confirm.html
with open(r'c:\Users\prasanth\OneDrive\Desktop\PRASANTH projects\clg canteen\order-confirm.html', 'rb') as f:
    conf = f.read().decode('utf-8')

print('\n=== order-confirm.html ===')
check('Correct Firebase msgId', conf, '26361828930')
check('paymentMethodDisplay', conf, 'paymentMethodDisplay')
check('paymentStatusDisplay', conf, 'paymentStatusDisplay')
check('paymentIdBox', conf, 'paymentIdBox')
check('isPaid variable', conf, 'isPaid')
check('methodLabels dict', conf, 'methodLabels')

# admin.js
with open(r'c:\Users\prasanth\OneDrive\Desktop\PRASANTH projects\clg canteen\admin.js', 'rb') as f:
    adm = f.read().decode('utf-8')

print('\n=== admin.js ===')
check('Revenue paid filter', adm, 'filter(o => o.paid)')
check('paymentMethod field', adm, 'paymentMethod: d.paymentMethod')
check('paidLabel variable', adm, 'paidLabel')
check('methodLabel variable', adm, 'methodLabel')
