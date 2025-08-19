// ===== 事務管理和服務層 (Transaction Management & Service Layer) =====

/**
 * TransactionManager - 事務管理器
 * 確保多表操作的原子性
 */
class TransactionManager {
  constructor() {
    this.operations = [];
    this.rollbackOperations = [];
    this.executed = [];
  }
  
  /**
   * 添加操作和對應的回滾操作
   */
  addOperation(operation, rollback) {
    this.operations.push({
      id: this.operations.length,
      execute: operation,
      rollback: rollback,
      description: operation.name || `Operation ${this.operations.length}`
    });
  }
  
  /**
   * 執行所有操作
   */
  async execute() {
    this.executed = [];
    let failedOperation = null;
    
    try {
      // 執行所有操作
      for (let i = 0; i < this.operations.length; i++) {
        const op = this.operations[i];
        
        try {
          Logger.log(`Executing transaction operation: ${op.description}`);
          const result = await op.execute();
          this.executed.push({
            operation: op,
            result: result
          });
          Logger.log(`Operation ${op.description} completed successfully`);
        } catch (error) {
          failedOperation = op;
          throw new TransactionError(
            `Transaction failed at operation "${op.description}": ${error.message}`,
            error
          );
        }
      }
      
      Logger.log(`Transaction completed successfully with ${this.executed.length} operations`);
      
      return {
        success: true,
        results: this.executed.map(e => e.result)
      };
      
    } catch (error) {
      Logger.log(`Transaction failed, starting rollback...`);
      
      // 回滾已執行的操作（反向順序）
      for (let i = this.executed.length - 1; i >= 0; i--) {
        const executedOp = this.executed[i];
        
        try {
          if (executedOp.operation.rollback) {
            Logger.log(`Rolling back operation: ${executedOp.operation.description}`);
            await executedOp.operation.rollback(executedOp.result);
            Logger.log(`Rollback successful for: ${executedOp.operation.description}`);
          }
        } catch (rollbackError) {
          Logger.log(`ERROR: Rollback failed for operation "${executedOp.operation.description}": ${rollbackError.message}`);
          // 繼續回滾其他操作
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 清空事務
   */
  clear() {
    this.operations = [];
    this.rollbackOperations = [];
    this.executed = [];
  }
}

/**
 * TransactionError - 事務錯誤
 */
class TransactionError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'TransactionError';
    this.originalError = originalError;
  }
}

/**
 * BookingService - 訂房服務層
 * 處理訂房相關的業務邏輯
 */
class BookingService {
  constructor() {
    this.bookingDAO = new BookingDAO();
    this.partnerDAO = new PartnerDAO();
    this.payoutDAO = new PayoutDAO();
    this.accommodationUsageDAO = new AccommodationUsageDAO();
  }
  
  /**
   * 創建訂房（含事務處理）
   */
  async createBooking(data) {
    const transaction = new TransactionManager();
    let booking = null;
    let partner = null;
    
    try {
      // 驗證輸入數據
      this.validateBookingData(data);
      
      // 如果有推薦人，驗證推薦人存在
      if (data.partner_code) {
        partner = this.partnerDAO.findByPartnerCode(data.partner_code);
        if (!partner) {
          throw new ValidationError(`Partner ${data.partner_code} not found`);
        }
      }
      
      // 操作1：創建訂房記錄
      transaction.addOperation(
        () => {
          booking = this.bookingDAO.create(data);
          return booking;
        },
        (createdBooking) => {
          if (createdBooking && createdBooking.id) {
            this.bookingDAO.delete(createdBooking.id);
          }
        }
      );
      
      // 操作2：如果有推薦人，更新推薦統計
      if (data.partner_code && partner) {
        transaction.addOperation(
          () => {
            return this.partnerDAO.updateReferralStats(data.partner_code, true);
          },
          () => {
            this.partnerDAO.updateReferralStats(data.partner_code, false);
          }
        );
      }
      
      // 執行事務
      const result = await transaction.execute();
      
      Logger.log(`Booking created successfully: ${JSON.stringify(result.results[0])}`);
      return result.results[0];
      
    } catch (error) {
      Logger.log(`Error creating booking: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 確認入住完成（含佣金計算和事務處理）
   */
  async confirmCheckinCompletion(bookingId, confirmedBy = 'system') {
    const transaction = new TransactionManager();
    
    try {
      // 查找訂房記錄
      const booking = this.bookingDAO.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(`Booking ${bookingId} not found`);
      }
      
      // 如果已經確認過，不重複處理
      if (booking.stay_status === 'COMPLETED') {
        Logger.log(`Booking ${bookingId} already completed`);
        return booking;
      }
      
      // 如果是 SELF_USE 訂房，不計算佣金
      const isSelfUse = booking.booking_source === 'SELF_USE';
      
      // 計算佣金
      const commissionData = isSelfUse ? 
        { amount: 0, type: 'NONE', isFirstBonus: false, firstBonusAmount: 0 } :
        this.calculateCommission(booking);
      
      // 操作1：更新訂房狀態
      transaction.addOperation(
        () => {
          return this.bookingDAO.update(bookingId, {
            stay_status: 'COMPLETED',
            commission_status: isSelfUse ? 'NOT_ELIGIBLE' : 'CALCULATED',
            commission_amount: commissionData.amount,
            commission_type: commissionData.type,
            is_first_referral_bonus: commissionData.isFirstBonus,
            first_referral_bonus_amount: commissionData.firstBonusAmount,
            manually_confirmed_by: confirmedBy,
            manually_confirmed_at: new Date()
          });
        },
        () => {
          this.bookingDAO.update(bookingId, {
            stay_status: booking.stay_status,
            commission_status: booking.commission_status,
            commission_amount: booking.commission_amount,
            commission_type: booking.commission_type,
            is_first_referral_bonus: booking.is_first_referral_bonus,
            first_referral_bonus_amount: booking.first_referral_bonus_amount,
            manually_confirmed_by: booking.manually_confirmed_by,
            manually_confirmed_at: booking.manually_confirmed_at
          });
        }
      );
      
      // 操作2：如果有佣金，更新大使數據
      if (!isSelfUse && booking.partner_code && commissionData.amount > 0) {
        const partner = this.partnerDAO.findByPartnerCode(booking.partner_code);
        
        if (partner) {
          // 更新成功推薦數和佣金
          transaction.addOperation(
            () => {
              this.partnerDAO.updateSuccessfulReferrals(booking.partner_code, true);
              return this.partnerDAO.updateCommission(booking.partner_code, commissionData.amount, true);
            },
            () => {
              this.partnerDAO.updateSuccessfulReferrals(booking.partner_code, false);
              this.partnerDAO.updateCommission(booking.partner_code, -commissionData.amount, true);
            }
          );
          
          // 檢查並更新等級
          transaction.addOperation(
            () => {
              return this.partnerDAO.checkAndUpdateLevel(booking.partner_code);
            },
            () => {
              // 等級更新的回滾比較複雜，這裡簡化處理
              Logger.log('Level update rollback - manual intervention may be needed');
            }
          );
          
          // 操作3：創建 Payout 記錄
          let payout = null;
          transaction.addOperation(
            () => {
              payout = this.payoutDAO.createCommissionPayout(
                booking.partner_code,
                commissionData.amount,
                bookingId,
                commissionData.type
              );
              return payout;
            },
            (createdPayout) => {
              if (createdPayout && createdPayout.id) {
                this.payoutDAO.delete(createdPayout.id);
              }
            }
          );
        }
      }
      
      // 執行事務
      const result = await transaction.execute();
      
      Logger.log(`Checkin confirmed successfully for booking ${bookingId}`);
      return result.results[0];
      
    } catch (error) {
      Logger.log(`Error confirming checkin: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 使用住宿金折抵（SELF_USE 訂房）
   */
  async useAccommodationPoints(partnerCode, deductAmount, bookingData) {
    const transaction = new TransactionManager();
    
    try {
      // 驗證大使
      const partner = this.partnerDAO.findByPartnerCode(partnerCode);
      if (!partner) {
        throw new NotFoundError(`Partner ${partnerCode} not found`);
      }
      
      // 驗證點數充足
      if ((partner.available_points || 0) < deductAmount) {
        throw new ValidationError(
          `Insufficient points. Available: ${partner.available_points}, Required: ${deductAmount}`
        );
      }
      
      // 準備訂房數據
      const selfUseBookingData = Object.assign({}, bookingData, {
        booking_source: 'SELF_USE',
        partner_code: partnerCode,
        notes: `住宿金折抵 NT$ ${deductAmount}，實付 NT$ ${(bookingData.room_price || 0) - deductAmount}`
      });
      
      let booking = null;
      let accommodationUsage = null;
      let payout = null;
      
      // 操作1：創建 SELF_USE 訂房記錄
      transaction.addOperation(
        () => {
          booking = this.bookingDAO.create(selfUseBookingData);
          return booking;
        },
        (createdBooking) => {
          if (createdBooking && createdBooking.id) {
            this.bookingDAO.delete(createdBooking.id);
          }
        }
      );
      
      // 操作2：扣除住宿金點數
      transaction.addOperation(
        () => {
          return this.partnerDAO.useAccommodationPoints(partnerCode, deductAmount);
        },
        () => {
          this.partnerDAO.refundAccommodationPoints(partnerCode, deductAmount);
        }
      );
      
      // 操作3：記錄住宿金使用
      transaction.addOperation(
        () => {
          accommodationUsage = this.accommodationUsageDAO.recordUsage(
            partnerCode,
            deductAmount,
            booking ? booking.id : null,
            'ROOM_DISCOUNT'
          );
          return accommodationUsage;
        },
        (createdUsage) => {
          if (createdUsage && createdUsage.id) {
            this.accommodationUsageDAO.delete(createdUsage.id);
          }
        }
      );
      
      // 操作4：創建 Payout 記錄（用於審計追蹤）
      transaction.addOperation(
        () => {
          payout = this.payoutDAO.create({
            partner_code: partnerCode,
            payout_type: 'POINTS_ADJUSTMENT_DEBIT',
            amount: -deductAmount,
            related_booking_ids: booking ? booking.id : null,
            payout_method: 'POINTS_ADJUSTMENT',
            payout_status: 'COMPLETED',
            notes: `住宿金折抵 - 訂房 #${booking ? booking.id : 'N/A'}`,
            created_by: 'system'
          });
          return payout;
        },
        (createdPayout) => {
          if (createdPayout && createdPayout.id) {
            this.payoutDAO.delete(createdPayout.id);
          }
        }
      );
      
      // 執行事務
      const result = await transaction.execute();
      
      Logger.log(`Accommodation points used successfully: ${deductAmount} points for partner ${partnerCode}`);
      return {
        booking: result.results[0],
        usage: result.results[2],
        payout: result.results[3]
      };
      
    } catch (error) {
      Logger.log(`Error using accommodation points: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 取消訂房（含返還處理）
   */
  async cancelBooking(bookingId, reason = '') {
    const transaction = new TransactionManager();
    
    try {
      // 查找訂房記錄
      const booking = this.bookingDAO.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(`Booking ${bookingId} not found`);
      }
      
      // 如果是 SELF_USE 訂房，需要返還點數
      if (booking.booking_source === 'SELF_USE') {
        // 查找相關的住宿金使用記錄
        const usages = this.accommodationUsageDAO.findByBookingId(bookingId);
        const totalRefund = usages.reduce((sum, usage) => sum + (parseFloat(usage.deduct_amount) || 0), 0);
        
        if (totalRefund > 0 && booking.partner_code) {
          // 操作1：返還點數
          transaction.addOperation(
            () => {
              return this.partnerDAO.refundAccommodationPoints(booking.partner_code, totalRefund);
            },
            () => {
              this.partnerDAO.useAccommodationPoints(booking.partner_code, totalRefund);
            }
          );
          
          // 操作2：刪除使用記錄
          transaction.addOperation(
            () => {
              return this.accommodationUsageDAO.deleteByBookingId(bookingId);
            },
            () => {
              // 使用記錄已刪除，無法完全回滾
              Logger.log('Accommodation usage deletion cannot be fully rolled back');
            }
          );
          
          // 操作3：創建返還 Payout 記錄
          transaction.addOperation(
            () => {
              return this.payoutDAO.createPointsRefund(
                booking.partner_code,
                totalRefund,
                bookingId,
                `取消訂單 ${bookingId}，返還住宿金 NT$ ${totalRefund}`
              );
            },
            (createdPayout) => {
              if (createdPayout && createdPayout.id) {
                this.payoutDAO.delete(createdPayout.id);
              }
            }
          );
        }
      }
      
      // 操作4：更新訂房狀態為取消
      transaction.addOperation(
        () => {
          return this.bookingDAO.cancelBooking(bookingId, reason);
        },
        () => {
          this.bookingDAO.update(bookingId, {
            stay_status: booking.stay_status,
            commission_status: booking.commission_status,
            notes: booking.notes
          });
        }
      );
      
      // 如果訂房已經產生佣金，需要處理佣金返還
      if (booking.commission_amount > 0 && booking.partner_code && booking.stay_status === 'COMPLETED') {
        // 操作5：扣除大使佣金
        transaction.addOperation(
          () => {
            return this.partnerDAO.updateCommission(
              booking.partner_code,
              -booking.commission_amount,
              true
            );
          },
          () => {
            this.partnerDAO.updateCommission(
              booking.partner_code,
              booking.commission_amount,
              true
            );
          }
        );
        
        // 操作6：取消相關的 Payout
        const relatedPayouts = this.payoutDAO.findByBookingId(bookingId);
        relatedPayouts.forEach(payout => {
          if (payout.payout_status !== 'COMPLETED') {
            transaction.addOperation(
              () => {
                return this.payoutDAO.cancelPayout(payout.id, `訂房 ${bookingId} 已取消`);
              },
              () => {
                this.payoutDAO.update(payout.id, {
                  payout_status: payout.payout_status,
                  notes: payout.notes
                });
              }
            );
          }
        });
      }
      
      // 執行事務
      const result = await transaction.execute();
      
      Logger.log(`Booking ${bookingId} cancelled successfully`);
      return result.results[result.results.length - 1]; // 返回更新後的訂房記錄
      
    } catch (error) {
      Logger.log(`Error cancelling booking: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 計算佣金
   */
  calculateCommission(booking) {
    if (!booking.partner_code) {
      return {
        amount: 0,
        type: 'NONE',
        isFirstBonus: false,
        firstBonusAmount: 0
      };
    }
    
    const partner = this.partnerDAO.findByPartnerCode(booking.partner_code);
    if (!partner) {
      return {
        amount: 0,
        type: 'NONE',
        isFirstBonus: false,
        firstBonusAmount: 0
      };
    }
    
    // 根據等級獲取佣金率
    const rates = CommissionRules.rates[partner.partner_level];
    if (!rates) {
      Logger.log(`Warning: No commission rates found for level ${partner.partner_level}`);
      return {
        amount: 0,
        type: 'NONE',
        isFirstBonus: false,
        firstBonusAmount: 0
      };
    }
    
    // 根據大使偏好決定佣金類型
    const commissionType = partner.commission_preference || 'ACCOMMODATION';
    const baseAmount = rates[commissionType.toLowerCase()] || 0;
    
    // 檢查是否首次推薦
    const isFirstBonus = (partner.successful_referrals || 0) === 0;
    const firstBonusAmount = isFirstBonus ? CommissionRules.firstReferralBonus : 0;
    
    return {
      amount: baseAmount + firstBonusAmount,
      type: commissionType,
      isFirstBonus: isFirstBonus,
      firstBonusAmount: firstBonusAmount
    };
  }
  
  /**
   * 驗證訂房數據
   */
  validateBookingData(data) {
    const errors = [];
    
    if (!data.guest_name) {
      errors.push('Guest name is required');
    }
    
    if (!data.guest_phone) {
      errors.push('Guest phone is required');
    }
    
    if (!data.checkin_date) {
      errors.push('Check-in date is required');
    }
    
    if (!data.checkout_date) {
      errors.push('Check-out date is required');
    }
    
    // 檢查退房日期是否在入住日期之後
    if (data.checkin_date && data.checkout_date) {
      const checkin = new Date(data.checkin_date);
      const checkout = new Date(data.checkout_date);
      
      if (checkout <= checkin) {
        errors.push('Check-out date must be after check-in date');
      }
    }
    
    if (!data.room_price || data.room_price <= 0) {
      errors.push('Valid room price is required');
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Booking validation failed', errors);
    }
    
    return true;
  }
}

/**
 * PayoutService - 結算服務層
 * 處理結算相關的業務邏輯
 */
class PayoutService {
  constructor() {
    this.payoutDAO = new PayoutDAO();
    this.partnerDAO = new PartnerDAO();
    this.bookingDAO = new BookingDAO();
  }
  
  /**
   * 創建混合結算（現金 + 住宿金）
   */
  async createMixedPayout(partnerCode, cashAmount, accommodationAmount, bookingIds = [], notes = '') {
    const transaction = new TransactionManager();
    const payouts = [];
    
    try {
      // 驗證大使
      const partner = this.partnerDAO.findByPartnerCode(partnerCode);
      if (!partner) {
        throw new NotFoundError(`Partner ${partnerCode} not found`);
      }
      
      // 驗證待支付金額
      const totalAmount = cashAmount + accommodationAmount;
      if (totalAmount <= 0) {
        throw new ValidationError('Payout amount must be greater than 0');
      }
      
      if ((partner.pending_commission || 0) < totalAmount) {
        throw new ValidationError(
          `Insufficient pending commission. Available: ${partner.pending_commission}, Required: ${totalAmount}`
        );
      }
      
      // 如果有現金部分
      if (cashAmount > 0) {
        transaction.addOperation(
          () => {
            const payout = this.payoutDAO.createCommissionPayout(
              partnerCode,
              cashAmount,
              bookingIds,
              'CASH'
            );
            payouts.push(payout);
            return payout;
          },
          (createdPayout) => {
            if (createdPayout && createdPayout.id) {
              this.payoutDAO.delete(createdPayout.id);
            }
          }
        );
      }
      
      // 如果有住宿金部分
      if (accommodationAmount > 0) {
        transaction.addOperation(
          () => {
            const payout = this.payoutDAO.createCommissionPayout(
              partnerCode,
              accommodationAmount,
              bookingIds,
              'ACCOMMODATION'
            );
            payouts.push(payout);
            return payout;
          },
          (createdPayout) => {
            if (createdPayout && createdPayout.id) {
              this.payoutDAO.delete(createdPayout.id);
            }
          }
        );
        
        // 增加可用住宿金點數
        transaction.addOperation(
          () => {
            return this.partnerDAO.update(partnerCode, {
              available_points: (partner.available_points || 0) + accommodationAmount
            });
          },
          () => {
            this.partnerDAO.update(partnerCode, {
              available_points: Math.max(0, (partner.available_points || 0) - accommodationAmount)
            });
          }
        );
      }
      
      // 扣除待支付佣金
      transaction.addOperation(
        () => {
          return this.partnerDAO.update(partnerCode, {
            pending_commission: Math.max(0, (partner.pending_commission || 0) - totalAmount),
            total_commission_paid: (partner.total_commission_paid || 0) + totalAmount
          });
        },
        () => {
          this.partnerDAO.update(partnerCode, {
            pending_commission: (partner.pending_commission || 0) + totalAmount,
            total_commission_paid: Math.max(0, (partner.total_commission_paid || 0) - totalAmount)
          });
        }
      );
      
      // 執行事務
      const result = await transaction.execute();
      
      Logger.log(`Mixed payout created successfully for partner ${partnerCode}`);
      return payouts;
      
    } catch (error) {
      Logger.log(`Error creating mixed payout: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 完成結算
   */
  async completePayout(payoutId, transferReference = null) {
    try {
      const payout = this.payoutDAO.findById(payoutId);
      if (!payout) {
        throw new NotFoundError(`Payout ${payoutId} not found`);
      }
      
      if (payout.payout_status === 'COMPLETED') {
        Logger.log(`Payout ${payoutId} already completed`);
        return payout;
      }
      
      return this.payoutDAO.completePayout(payoutId, transferReference);
      
    } catch (error) {
      Logger.log(`Error completing payout: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 生成結算報表
   */
  generatePayoutReport(startDate = null, endDate = null) {
    try {
      let payouts = this.payoutDAO.findAll();
      
      // 日期篩選
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date('2000-01-01');
        const end = endDate ? new Date(endDate) : new Date();
        
        payouts = payouts.filter(payout => {
          const payoutDate = new Date(payout.created_at);
          return payoutDate >= start && payoutDate <= end;
        });
      }
      
      // 統計數據
      const stats = {
        totalPayouts: payouts.length,
        totalAmount: this.payoutDAO.calculateTotalAmount(payouts),
        byType: this.payoutDAO.groupByType(payouts),
        byStatus: this.groupByStatus(payouts),
        byPartner: this.groupByPartner(payouts)
      };
      
      return stats;
      
    } catch (error) {
      Logger.log(`Error generating payout report: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 按狀態分組
   */
  groupByStatus(payouts) {
    const grouped = {};
    
    payouts.forEach(payout => {
      const status = payout.payout_status || 'UNKNOWN';
      if (!grouped[status]) {
        grouped[status] = {
          count: 0,
          total: 0,
          items: []
        };
      }
      
      grouped[status].count++;
      grouped[status].total += parseFloat(payout.amount) || 0;
      grouped[status].items.push(payout);
    });
    
    return grouped;
  }
  
  /**
   * 按大使分組
   */
  groupByPartner(payouts) {
    const grouped = {};
    
    payouts.forEach(payout => {
      const partner = payout.partner_code;
      if (!grouped[partner]) {
        grouped[partner] = {
          count: 0,
          total: 0,
          items: []
        };
      }
      
      grouped[partner].count++;
      grouped[partner].total += parseFloat(payout.amount) || 0;
      grouped[partner].items.push(payout);
    });
    
    return grouped;
  }
}

// 匯出給 Google Apps Script 使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TransactionManager,
    TransactionError,
    BookingService,
    PayoutService
  };
}