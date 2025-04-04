const claimer = require('role.claimer');
const dismantler = require('role.dismantler');
const remoteMiner = require('role.remoteMiner');
const remoteHauler = require('role.remoteHauler');

/**
 * 入侵管理器
 * 负责协调入侵其他房间的操作
 */
const invasionManager = {
    /**
     * 添加入侵任务
     * @param {string} sourceRoomName - 源房间名称
     * @param {string} targetRoomName - 目标房间名称
     * @param {Object} options - 入侵选项
     * @param {boolean} options.claim - 是否占领房间
     * @param {boolean} options.dismantle - 是否拆除建筑
     * @param {number} options.dismantlerCount - 拆除者数量
     * @param {string} options.claimMode - 占领模式: 'claim', 'reserve', 'attack'
     * @param {boolean} options.remoteMining - 是否启用远程采矿（预定模式下）
     * @param {number} options.remoteMinerCount - 远程矿工数量
     * @param {number} options.remoteHaulerCount - 远程运输者数量
     */
    startInvasion: function(sourceRoomName, targetRoomName, options = {}) {
        // 默认选项
        const defaultOptions = {
            claim: true,
            dismantle: true,
            dismantlerCount: 2,
            claimMode: 'claim',
            remoteMining: false,
            remoteMinerCount: 1,
            remoteHaulerCount: 1
        };
        
        // 合并选项
        const finalOptions = {...defaultOptions, ...options};
        
        // 检查源房间是否存在
        const sourceRoom = Game.rooms[sourceRoomName];
        if(!sourceRoom) {
            console.log(`错误: 源房间 ${sourceRoomName} 不存在或无法访问`);
            return false;
        }
        
        // 初始化入侵记录
        if(!Memory.invasions) {
            Memory.invasions = {};
        }
        
        // 记录入侵任务
        Memory.invasions[targetRoomName] = {
            sourceRoom: sourceRoomName,
            targetRoom: targetRoomName,
            startTime: Game.time,
            status: 'preparing',
            options: finalOptions,
            lastClaimerCheck: Game.time, // 添加最后检查claimer的时间
            lastDismantlerCheck: Game.time, // 添加最后检查dismantler的时间
            lastRemoteMinerCheck: Game.time, // 添加最后检查远程矿工的时间
            lastRemoteHaulerCheck: Game.time // 添加最后检查远程运输者的时间
        };
        
        console.log(`开始入侵 ${targetRoomName} (从 ${sourceRoomName})`);
        
        // 初始化源房间对目标房间的creep计数目标
        this.updateInvasionCreepTargets(targetRoomName);
        
        return true;
    },
    
    /**
     * 处理入侵任务
     */
    processInvasions: function() {
        // 如果没有入侵记录，直接返回
        if(!Memory.invasions) return;
        
        // 遍历所有入侵任务
        for(const targetRoomName in Memory.invasions) {
            const invasion = Memory.invasions[targetRoomName];
            
            // 检查入侵是否已完成
            this.checkInvasionStatus(targetRoomName, invasion);
            
            // 只有未完成的任务才需要检查creep状态
            if(invasion.status !== 'completed' && invasion.status !== 'failed') {
                // 更新该入侵任务的creep目标数量
                this.updateInvasionCreepTargets(targetRoomName);
            }
        }
    },
    
    /**
     * 更新入侵任务所需的creep目标数量
     * @param {string} targetRoomName - 目标房间名称
     */
    updateInvasionCreepTargets: function(targetRoomName) {
        if(!Memory.invasions || !Memory.invasions[targetRoomName]) return;
        
        const invasion = Memory.invasions[targetRoomName];
        const sourceRoomName = invasion.sourceRoom;
        
        // 确保房间的creep目标计数存在
        if(!Memory.rooms) Memory.rooms = {};
        if(!Memory.rooms[sourceRoomName]) Memory.rooms[sourceRoomName] = {};
        if(!Memory.rooms[sourceRoomName].targetCreepCounts) Memory.rooms[sourceRoomName].targetCreepCounts = {};
        
        const targetCounts = Memory.rooms[sourceRoomName].targetCreepCounts;
        
        // 确保creepConfigs对象存在
        if(!Memory.creepConfigs) Memory.creepConfigs = {};
        
        // 处理claimer目标数量
        if(invasion.options.claim && 
          (invasion.options.claimMode === 'reserve' || 
           (invasion.options.claimMode === 'claim' && invasion.status !== 'controller_claimed'))) {
            
            // 查找针对该目标房间的claimer（同时检查homeRoom和targetRoom）
            const claimers = _.filter(Game.creeps, creep => 
                creep.memory.role === 'claimer' && 
                creep.memory.homeRoom === sourceRoomName &&
                creep.memory.targetRoom === targetRoomName
            );
            
            // 设置claimer目标数量为1或0
            targetCounts.claimer = claimers.length === 0 ? 1 : 0;
            
            // 设置claimer的特殊参数
            if(!Memory.creepConfigs.claimer) Memory.creepConfigs.claimer = {};
            if(!Memory.creepConfigs.claimer[sourceRoomName]) Memory.creepConfigs.claimer[sourceRoomName] = {};
            
            Memory.creepConfigs.claimer[sourceRoomName] = {
                targetRoom: targetRoomName,
                mode: invasion.options.claimMode
            };
        }
        
        // 处理dismantler目标数量
        if(invasion.options.dismantle && !invasion.dismantleCompleted) {
            // 查找针对该目标房间的dismantler（同时检查homeRoom和targetRoom）
            const dismantlers = _.filter(Game.creeps, creep => 
                creep.memory.role === 'dismantler' && 
                creep.memory.homeRoom === sourceRoomName &&
                creep.memory.targetRoom === targetRoomName
            );
            
            // 设置dismantler目标数量
            targetCounts.dismantler = Math.max(0, invasion.options.dismantlerCount - dismantlers.length);
            
            // 设置dismantler的特殊参数
            if(!Memory.creepConfigs.dismantler) Memory.creepConfigs.dismantler = {};
            if(!Memory.creepConfigs.dismantler[sourceRoomName]) Memory.creepConfigs.dismantler[sourceRoomName] = {};
            
            Memory.creepConfigs.dismantler[sourceRoomName] = {
                targetRoom: targetRoomName
            };
        }
        
        // 处理远程矿工和运输者
        if(invasion.options.remoteMining && 
           invasion.options.claimMode === 'reserve' && 
           invasion.status === 'controller_reserved') {
            
            // 查找针对该目标房间的远程矿工（同时检查homeRoom和targetRoom）
            const remoteMiners = _.filter(Game.creeps, creep => 
                creep.memory.role === 'remoteMiner' && 
                creep.memory.homeRoom === sourceRoomName &&
                creep.memory.targetRoom === targetRoomName
            );
            
            // 设置远程矿工目标数量
            targetCounts.remoteMiner = Math.max(0, invasion.options.remoteMinerCount - remoteMiners.length);
            
            // 设置远程矿工的特殊参数
            if(!Memory.creepConfigs.remoteMiner) Memory.creepConfigs.remoteMiner = {};
            if(!Memory.creepConfigs.remoteMiner[sourceRoomName]) Memory.creepConfigs.remoteMiner[sourceRoomName] = {};
            
            Memory.creepConfigs.remoteMiner[sourceRoomName] = {
                targetRoom: targetRoomName
            };
            
            // 查找针对该目标房间的远程运输者（同时检查homeRoom和targetRoom）
            const remoteHaulers = _.filter(Game.creeps, creep => 
                creep.memory.role === 'remoteHauler' && 
                creep.memory.homeRoom === sourceRoomName &&
                creep.memory.targetRoom === targetRoomName
            );
            
            // 设置远程运输者目标数量
            targetCounts.remoteHauler = Math.max(0, invasion.options.remoteHaulerCount - remoteHaulers.length);
            
            // 设置远程运输者的特殊参数
            if(!Memory.creepConfigs.remoteHauler) Memory.creepConfigs.remoteHauler = {};
            if(!Memory.creepConfigs.remoteHauler[sourceRoomName]) Memory.creepConfigs.remoteHauler[sourceRoomName] = {};
            
            Memory.creepConfigs.remoteHauler[sourceRoomName] = {
                targetRoom: targetRoomName
            };
        }
    },
    
    /**
     * 检查入侵状态
     * @param {string} targetRoomName - 目标房间名称
     * @param {Object} invasion - 入侵任务对象
     */
    checkInvasionStatus: function(targetRoomName, invasion) {
        // 如果任务已经标记为完成，不再处理
        if(invasion.status === 'completed' || invasion.status === 'failed') {
            return;
        }
        
        // 获取目标房间
        const targetRoom = Game.rooms[targetRoomName];
        
        // 如果没有视野，无法确定状态
        if(!targetRoom) {
            // 如果入侵已经持续了太长时间，标记为失败
            // 但如果是reserve模式，则不将任务标记为失败，因为这可能是长期任务
            if(Game.time - invasion.startTime > 10000 && invasion.options.claimMode !== 'reserve') {
                console.log(`入侵 ${targetRoomName} 超时，标记为失败`);
                invasion.status = 'failed';
            }
            return;
        }
        
        // 检查控制器是否已被占领或预定
        if(invasion.options.claim) {
            if(targetRoom.controller) {
                // 如果是我们的控制器，标记为已占领
                if(targetRoom.controller.my) {
                    console.log(`成功占领 ${targetRoomName} 的控制器!`);
                    invasion.status = 'controller_claimed';
                    
                    // 如果拆除任务已完成或未请求，标记整个入侵为完成
                    if(!invasion.options.dismantle || invasion.dismantleCompleted) {
                        invasion.status = 'completed';
                        console.log(`入侵 ${targetRoomName} 完成!`);
                    }
                }
                // 如果是reserve模式，检查是否已经预定了控制器
                else if(invasion.options.claimMode === 'reserve') {
                    if(targetRoom.controller.reservation && 
                       targetRoom.controller.reservation.username === Game.spawns[Object.keys(Game.spawns)[0]].owner.username) {
                        // 已预定，但不标记为完成，因为我们要持续预定
                        if(invasion.status !== 'controller_reserved') {
                            console.log(`已成功预定 ${targetRoomName} 的控制器`);
                            invasion.status = 'controller_reserved';
                        }
                    }
                }
            }
        }
        
        // 检查拆除任务是否完成
        if(invasion.options.dismantle && !invasion.dismantleCompleted) {
            const hostileStructures = targetRoom.find(FIND_HOSTILE_STRUCTURES);
            
            // 如果没有敌方建筑，拆除任务完成
            if(hostileStructures.length === 0) {
                console.log(`所有敌方建筑在 ${targetRoomName} 已拆除!`);
                invasion.dismantleCompleted = true;
                
                // 如果控制器已被占领或不需要占领，标记整个入侵为完成
                // 注意：如果是reserve模式，我们永远不会将任务标记为完成
                if(!invasion.options.claim || 
                   (invasion.status === 'controller_claimed' && invasion.options.claimMode !== 'reserve')) {
                    invasion.status = 'completed';
                    console.log(`入侵 ${targetRoomName} 完成!`);
                }
            }
        }
    },
    
    /**
     * 取消入侵任务
     * @param {string} targetRoomName - 目标房间名称
     */
    cancelInvasion: function(targetRoomName) {
        if(!Memory.invasions || !Memory.invasions[targetRoomName]) {
            console.log(`没有对 ${targetRoomName} 的入侵任务`);
            return false;
        }
        
        // 获取源房间名称
        const sourceRoomName = Memory.invasions[targetRoomName].sourceRoom;
        
        // 清除该任务相关的creep目标数量
        if(Memory.rooms && Memory.rooms[sourceRoomName] && Memory.rooms[sourceRoomName].targetCreepCounts) {
            const targetCounts = Memory.rooms[sourceRoomName].targetCreepCounts;
            delete targetCounts.claimer;
            delete targetCounts.dismantler;
            delete targetCounts.remoteMiner;
            delete targetCounts.remoteHauler;
        }
        
        console.log(`取消对 ${targetRoomName} 的入侵任务`);
        delete Memory.invasions[targetRoomName];
        return true;
    },
    
    /**
     * 获取所有入侵任务状态
     * @returns {Object} - 入侵任务状态对象
     */
    getInvasionStatus: function() {
        if(!Memory.invasions) {
            return {};
        }
        
        return Memory.invasions;
    },
    
    /**
     * 启用远程采矿功能
     * @param {string} targetRoomName - 目标房间名称
     * @param {number} minerCount - 矿工数量
     * @param {number} haulerCount - 运输者数量
     */
    enableRemoteMining: function(targetRoomName, minerCount = 1, haulerCount = 1) {
        if(!Memory.invasions || !Memory.invasions[targetRoomName]) {
            console.log(`没有对 ${targetRoomName} 的入侵任务`);
            return false;
        }
        
        const invasion = Memory.invasions[targetRoomName];
        
        // 只有预定模式可以启用远程采矿
        if(invasion.options.claimMode !== 'reserve') {
            console.log(`只有预定(reserve)模式的入侵可以启用远程采矿`);
            return false;
        }
        
        invasion.options.remoteMining = true;
        invasion.options.remoteMinerCount = minerCount;
        invasion.options.remoteHaulerCount = haulerCount;
        
        // 更新creep目标数量
        this.updateInvasionCreepTargets(targetRoomName);
        
        console.log(`已启用对 ${targetRoomName} 的远程采矿，矿工: ${minerCount}，运输者: ${haulerCount}`);
        
        return true;
    },
    
    /**
     * 禁用远程采矿功能
     * @param {string} targetRoomName - 目标房间名称
     */
    disableRemoteMining: function(targetRoomName) {
        if(!Memory.invasions || !Memory.invasions[targetRoomName]) {
            console.log(`没有对 ${targetRoomName} 的入侵任务`);
            return false;
        }
        
        Memory.invasions[targetRoomName].options.remoteMining = false;
        
        // 清除远程矿工和运输者的目标数量
        const sourceRoomName = Memory.invasions[targetRoomName].sourceRoom;
        if(Memory.rooms && Memory.rooms[sourceRoomName] && Memory.rooms[sourceRoomName].targetCreepCounts) {
            const targetCounts = Memory.rooms[sourceRoomName].targetCreepCounts;
            delete targetCounts.remoteMiner;
            delete targetCounts.remoteHauler;
        }
        
        console.log(`已禁用对 ${targetRoomName} 的远程采矿`);
        return true;
    }
};

module.exports = invasionManager; 