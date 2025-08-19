// ===== 數據模型定義 (Data Models) =====
// 定義所有表格的結構和驗證規則

const DataModels = {
  /**
   * Bookings 表格模型
   */
  Booking: {
    tableName: 'Bookings',
    fields: {
      id: { 
        type: 'number', 
        required: true, 
        autoGenerate: true,
        description: '唯一識別符'
      },
      partner_code: { 
        type: 'string', 
        required: false,
        description: '推薦大使代碼'
      },
      guest_name: { 
        type: 'string', 
        required: true, 
        maxLength: 100,
        description: '房客姓名'
      },
      guest_phone: { 
        type: 'string', 
        required: true, 
        pattern: /^[\d\-\+\s\(\)]+$/,
        description: '房客電話'
      },
      guest_email: { 
        type: 'email', 
        required: false,
        description: '房客Email'
      },
      bank_account_last5: { 
        type: 'string', 
        required: false, 
        length: 5,
        description: '銀行帳號後5碼'
      },
      checkin_date: { 
        type: 'date', 
        required: true,
        description: '入住日期'
      },
      checkout_date: { 
        type: 'date', 
        required: true,
        description: '退房日期'
      },
      room_price: { 
        type: 'number', 
        required: true, 
        min: 0,
        description: '房價'
      },
      booking_source: { 
        type: 'enum', 
        values: ['MANUAL_ENTRY', 'SELF_USE', 'ONLINE', 'PHONE', 'WALK_IN'], 
        default: 'MANUAL_ENTRY',
        description: '訂房來源'
      },
      stay_status: { 
        type: 'enum', 
        values: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], 
        default: 'PENDING',
        description: '住宿狀態'
      },
      payment_status: { 
        type: 'enum', 
        values: ['PENDING', 'PAID', 'PARTIAL', 'REFUNDED'], 
        default: 'PENDING',
        description: '付款狀態'
      },
      commission_status: { 
        type: 'enum', 
        values: ['NOT_ELIGIBLE', 'PENDING', 'CALCULATED', 'PAID', 'CANCELLED'], 
        default: 'NOT_ELIGIBLE',
        description: '佣金狀態'
      },
      commission_amount: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '佣金金額'
      },
      commission_type: { 
        type: 'enum', 
        values: ['CASH', 'ACCOMMODATION', 'MIXED', 'NONE'], 
        default: 'ACCOMMODATION',
        description: '佣金類型'
      },
      is_first_referral_bonus: { 
        type: 'boolean', 
        default: false,
        description: '是否為首次推薦獎勵'
      },
      first_referral_bonus_amount: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '首次推薦獎勵金額'
      },
      manually_confirmed_by: { 
        type: 'string', 
        required: false,
        description: '手動確認者'
      },
      manually_confirmed_at: { 
        type: 'datetime', 
        required: false,
        description: '手動確認時間'
      },
      notes: { 
        type: 'string', 
        required: false,
        maxLength: 500,
        description: '備註'
      },
      created_at: { 
        type: 'datetime', 
        autoGenerate: true,
        description: '創建時間'
      },
      updated_at: { 
        type: 'datetime', 
        autoUpdate: true,
        description: '更新時間'
      }
    },
    indexes: ['id', 'partner_code', 'guest_phone', 'checkin_date'],
    uniqueKeys: ['id'],
    businessRules: {
      checkoutAfterCheckin: 'checkout_date must be after checkin_date',
      validCommission: 'commission_amount must be 0 when commission_status is NOT_ELIGIBLE'
    }
  },

  /**
   * Partners 表格模型
   */
  Partner: {
    tableName: 'Partners',
    fields: {
      partner_code: { 
        type: 'string', 
        required: true, 
        unique: true,
        pattern: /^[A-Z0-9_]+$/,
        description: '大使代碼（唯一）'
      },
      partner_name: { 
        type: 'string', 
        required: true,
        maxLength: 100,
        description: '大使姓名'
      },
      partner_level: { 
        type: 'enum', 
        values: ['LV1_INSIDER', 'LV2_GUIDE', 'LV3_GUARDIAN'], 
        default: 'LV1_INSIDER',
        description: '大使等級'
      },
      contact_phone: { 
        type: 'string', 
        required: true,
        pattern: /^[\d\-\+\s\(\)]+$/,
        description: '聯絡電話'
      },
      contact_email: { 
        type: 'email', 
        required: false,
        description: '聯絡Email'
      },
      bank_code: { 
        type: 'string', 
        required: false,
        pattern: /^\d{3}$/,
        description: '銀行代碼'
      },
      bank_account: { 
        type: 'string', 
        required: false,
        pattern: /^\d{10,16}$/,
        description: '銀行帳號'
      },
      commission_preference: { 
        type: 'enum', 
        values: ['CASH', 'ACCOMMODATION'], 
        default: 'ACCOMMODATION',
        description: '佣金偏好'
      },
      total_referrals: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '總推薦數'
      },
      successful_referrals: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '成功推薦數'
      },
      yearly_referrals: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '年度推薦數'
      },
      total_commission_earned: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '累積佣金總額'
      },
      total_commission_paid: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '已支付佣金總額'
      },
      available_points: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '可用住宿金點數'
      },
      points_used: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '已使用點數'
      },
      pending_commission: { 
        type: 'number', 
        default: 0,
        min: 0,
        description: '待支付佣金'
      },
      join_date: { 
        type: 'date', 
        autoGenerate: true,
        description: '加入日期'
      },
      is_active: { 
        type: 'boolean', 
        default: true,
        description: '是否啟用'
      },
      line_coupon_url: { 
        type: 'string', 
        required: false,
        description: 'LINE 優惠券連結'
      },
      notes: { 
        type: 'string', 
        required: false,
        maxLength: 500,
        description: '備註'
      },
      created_at: { 
        type: 'datetime', 
        autoGenerate: true,
        description: '創建時間'
      },
      updated_at: { 
        type: 'datetime', 
        autoUpdate: true,
        description: '更新時間'
      }
    },
    indexes: ['partner_code', 'contact_phone', 'partner_level'],
    uniqueKeys: ['partner_code'],
    businessRules: {
      validPoints: 'available_points + points_used must equal total points earned from accommodation commissions',
      levelProgression: 'partner_level should match yearly_referrals thresholds'
    }
  },

  /**
   * Payouts 表格模型
   */
  Payout: {
    tableName: 'Payouts',
    fields: {
      id: { 
        type: 'number', 
        required: true, 
        autoGenerate: true,
        description: '唯一識別符'
      },
      partner_code: { 
        type: 'string', 
        required: true,
        description: '大使代碼'
      },
      payout_type: { 
        type: 'enum', 
        values: [
          'CASH', 
          'ACCOMMODATION', 
          'POINTS_REFUND', 
          'POINTS_ADJUSTMENT_DEBIT', 
          'POINTS_ADJUSTMENT_CREDIT',
          'COMMISSION_ADJUSTMENT'
        ], 
        required: true,
        description: '結算類型'
      },
      amount: { 
        type: 'number', 
        required: true,
        description: '金額（負數表示扣除）'
      },
      related_booking_ids: { 
        type: 'string', 
        required: false,
        description: '相關訂房ID（逗號分隔）'
      },
      payout_method: { 
        type: 'enum', 
        values: [
          'BANK_TRANSFER', 
          'ACCOMMODATION_VOUCHER', 
          'ACCOMMODATION_REFUND', 
          'CASH', 
          'POINTS_ADJUSTMENT',
          'OTHER'
        ],
        default: 'OTHER',
        description: '付款方式'
      },
      payout_status: { 
        type: 'enum', 
        values: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'], 
        default: 'PENDING',
        description: '結算狀態'
      },
      bank_transfer_date: { 
        type: 'date', 
        required: false,
        description: '銀行轉帳日期'
      },
      bank_transfer_reference: { 
        type: 'string', 
        required: false,
        description: '銀行轉帳參考號'
      },
      accommodation_voucher_code: { 
        type: 'string', 
        required: false,
        description: '住宿券代碼'
      },
      notes: { 
        type: 'string', 
        required: false,
        maxLength: 500,
        description: '備註'
      },
      created_by: { 
        type: 'string', 
        default: 'system',
        description: '創建者'
      },
      created_at: { 
        type: 'datetime', 
        autoGenerate: true,
        description: '創建時間'
      },
      updated_at: { 
        type: 'datetime', 
        autoUpdate: true,
        description: '更新時間'
      }
    },
    indexes: ['id', 'partner_code', 'payout_status', 'payout_type'],
    uniqueKeys: ['id'],
    businessRules: {
      validAmount: 'amount can be negative only for refund or adjustment types',
      statusTransition: 'status can only move forward: PENDING -> PROCESSING -> COMPLETED'
    }
  },

  /**
   * Accommodation_Usage 表格模型
   */
  AccommodationUsage: {
    tableName: 'Accommodation_Usage',
    fields: {
      id: { 
        type: 'number', 
        required: true, 
        autoGenerate: true,
        description: '唯一識別符'
      },
      partner_code: { 
        type: 'string', 
        required: true,
        description: '大使代碼'
      },
      deduct_amount: { 
        type: 'number', 
        required: true,
        min: 0,
        description: '折抵金額'
      },
      related_booking_id: { 
        type: 'string', 
        required: false,
        description: '相關訂房ID'
      },
      usage_date: { 
        type: 'date', 
        required: true,
        description: '使用日期'
      },
      usage_type: { 
        type: 'enum', 
        values: ['ROOM_DISCOUNT', 'GIFT_VOUCHER', 'TRANSFER', 'OTHER'], 
        default: 'ROOM_DISCOUNT',
        description: '使用類型'
      },
      notes: { 
        type: 'string', 
        required: false,
        maxLength: 500,
        description: '備註'
      },
      created_by: { 
        type: 'string', 
        default: 'system',
        description: '創建者'
      },
      created_at: { 
        type: 'datetime', 
        autoGenerate: true,
        description: '創建時間'
      },
      updated_at: { 
        type: 'datetime', 
        autoUpdate: true,
        description: '更新時間'
      }
    },
    indexes: ['id', 'partner_code', 'related_booking_id'],
    uniqueKeys: ['id'],
    businessRules: {
      validDeduction: 'deduct_amount must not exceed partner available_points'
    }
  },

  /**
   * Clicks 表格模型（追蹤連結點擊）
   */
  Click: {
    tableName: 'Clicks',
    fields: {
      id: { 
        type: 'number', 
        required: true, 
        autoGenerate: true,
        description: '唯一識別符'
      },
      partner_code: { 
        type: 'string', 
        required: false,
        description: '大使代碼'
      },
      click_time: { 
        type: 'datetime', 
        autoGenerate: true,
        description: '點擊時間'
      },
      destination: { 
        type: 'string', 
        required: false,
        description: '目標頁面'
      },
      utm_source: { 
        type: 'string', 
        required: false,
        description: 'UTM 來源'
      },
      utm_medium: { 
        type: 'string', 
        required: false,
        description: 'UTM 媒介'
      },
      utm_campaign: { 
        type: 'string', 
        required: false,
        description: 'UTM 活動'
      },
      ip_address: { 
        type: 'string', 
        required: false,
        description: 'IP 地址'
      },
      user_agent: { 
        type: 'string', 
        required: false,
        maxLength: 500,
        description: '用戶代理'
      },
      created_at: { 
        type: 'datetime', 
        autoGenerate: true,
        description: '創建時間'
      }
    },
    indexes: ['id', 'partner_code', 'click_time'],
    uniqueKeys: ['id']
  }
};

/**
 * 佣金計算規則
 */
const CommissionRules = {
  rates: {
    'LV1_INSIDER': { 
      accommodation: 1000, 
      cash: 500,
      description: 'LV1 知音大使'
    },
    'LV2_GUIDE': { 
      accommodation: 1200, 
      cash: 600,
      description: 'LV2 森林嚮導'
    },
    'LV3_GUARDIAN': { 
      accommodation: 1500, 
      cash: 800,
      description: 'LV3 秘境守護者'
    }
  },
  firstReferralBonus: 1500,
  levelRequirements: {
    'LV2_GUIDE': 4,   // 年度4組成功推薦
    'LV3_GUARDIAN': 10 // 年度10組成功推薦
  }
};

/**
 * 系統配置
 */
const SystemConfig = {
  sheetsId: '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4',
  githubPagesUrl: 'https://didi1119.github.io/forest-gift-v1/index.html',
  defaultLineCouponUrl: 'https://lin.ee/q38pqot',
  timezone: 'Asia/Taipei',
  dateFormat: 'yyyy-MM-dd',
  datetimeFormat: 'yyyy-MM-dd HH:mm:ss'
};

// 匯出給 Google Apps Script 使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DataModels,
    CommissionRules,
    SystemConfig
  };
}