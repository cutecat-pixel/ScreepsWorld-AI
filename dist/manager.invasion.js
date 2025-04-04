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
        
        // 创建请求
        if(finalOptions.dismantle) {
            dismantler.createDismantleTask(sourceRoomName, targetRoomName, finalOptions.dismantlerCount);
        }
        
        if(finalOptions.claim) {
            claimer.createClaimTask(sourceRoomName, targetRoomName, finalOptions.claimMode);
        }
        
        // 如果启用了远程采矿且是预定模式，创建远程矿工和运输者
        if(finalOptions.remoteMining && finalOptions.claimMode === 'reserve') {
            // 创建远程矿工
            for(let i = 0; i < finalOptions.remoteMinerCount; i++) {
                remoteMiner.createRemoteMinerTask(sourceRoomName, targetRoomName);
            }
            
            // 创建远程运输者
            for(let i = 0; i < finalOptions.remoteHaulerCount; i++) {
                remoteHauler.createRemoteHaulerTask(sourceRoomName, targetRoomName);
            }
        }
        
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
                // 检查并补充需要的creeps
                this.checkAndReplaceCreeps(targetRoomName, invasion);
            }
        }
    },
    
    /**
     * 检查并补充需要的creeps
     * @param {string} targetRoomName - 目标房间名称
     * @param {Object} invasion - 入侵任务对象
     */
    checkAndReplaceCreeps: function(targetRoomName, invasion) {
        const sourceRoomName = invasion.sourceRoom;
        
        // 只有在reserve模式或未完成的claim模式下才需要持续检查claimer
        if(invasion.options.claim && 
          (invasion.options.claimMode === 'reserve' || 
           (invasion.options.claimMode === 'claim' && invasion.status !== 'controller_claimed'))) {
            
            // 每100个tick检查一次claimer状态
            if(Game.time - invasion.lastClaimerCheck >= 100) {
                invasion.lastClaimerCheck = Game.time;
                
                // 查找针对该目标房间的claimer
                const claimers = _.filter(Game.creeps, creep => 
                    creep.memory.role === 'claimer' && 
                    creep.memory.targetRoom === targetRoomName
                );
                
                // 如果没有claimer，创建新的
                if(claimers.length === 0) {
                    console.log(`没有claimer正在前往 ${targetRoomName}，创建新的claimer`);
                    claimer.createClaimTask(sourceRoomName, targetRoomName, invasion.options.claimMode);
                }
            }
        }
        
        // 检查dismantler状态(如果拆除任务未完成)
        if(invasion.options.dismantle && !invasion.dismantleCompleted) {
            // 每150个tick检查一次dismantler状态
            if(Game.time - invasion.lastDismantlerCheck >= 150) {
                invasion.lastDismantlerCheck = Game.time;
                
                // 查找针对该目标房间的dismantler
                const dismantlers = _.filter(Game.creeps, creep => 
                    creep.memory.role === 'dismantler' && 
                    creep.memory.targetRoom === targetRoomName
                );
                
                // 如果dismantler数量低于要求，创建新的
                if(dismantlers.length < invasion.options.dismantlerCount) {
                    console.log(`只有 ${dismantlers.length}/${invasion.options.dismantlerCount} 的dismantler在 ${targetRoomName}，创建额外的dismantler`);
                    const needCount = invasion.options.dismantlerCount - dismantlers.length;
                    dismantler.createDismantleTask(sourceRoomName, targetRoomName, needCount);
                }
            }
        }
        
        // 如果启用了远程采矿且房间已被预定，检查远程矿工和运输者
        if(invasion.options.remoteMining && 
           invasion.options.claimMode === 'reserve' && 
           invasion.status === 'controller_reserved') {
            
            // 检查远程矿工状态
            if(Game.time - invasion.lastRemoteMinerCheck >= 200) {
                invasion.lastRemoteMinerCheck = Game.time;
                
                // 查找针对该目标房间的远程矿工
                const remoteMiners = _.filter(Game.creeps, creep => 
                    creep.memory.role === 'remoteMiner' && 
                    creep.memory.targetRoom === targetRoomName
                );
                
                // 如果远程矿工数量低于要求，创建新的
                if(remoteMiners.length < invasion.options.remoteMinerCount) {
                    console.log(`只有 ${remoteMiners.length}/${invasion.options.remoteMinerCount} 的远程矿工在 ${targetRoomName}，创建额外的矿工`);
                    const needCount = invasion.options.remoteMinerCount - remoteMiners.length;
                    for(let i = 0; i < needCount; i++) {
                        remoteMiner.createRemoteMinerTask(sourceRoomName, targetRoomName);
                    }
                }
            }
            
            // 检查远程运输者状态
            if(Game.time - invasion.lastRemoteHaulerCheck >= 150) {
                invasion.lastRemoteHaulerCheck = Game.time;
                
                // 查找针对该目标房间的远程运输者
                const remoteHaulers = _.filter(Game.creeps, creep => 
                    creep.memory.role === 'remoteHauler' && 
                    creep.memory.targetRoom === targetRoomName
                );
                
                // 如果远程运输者数量低于要求，创建新的
                if(remoteHaulers.length < invasion.options.remoteHaulerCount) {
                    console.log(`只有 ${remoteHaulers.length}/${invasion.options.remoteHaulerCount} 的远程运输者在 ${targetRoomName}，创建额外的运输者`);
                    const needCount = invasion.options.remoteHaulerCount - remoteHaulers.length;
                    for(let i = 0; i < needCount; i++) {
                        remoteHauler.createRemoteHaulerTask(sourceRoomName, targetRoomName);
                    }
                }
            }
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
        
        console.log(`已启用对 ${targetRoomName} 的远程采矿，矿工: ${minerCount}，运输者: ${haulerCount}`);
        
        // 如果房间已被预定，立即创建矿工和运输者
        if(invasion.status === 'controller_reserved') {
            for(let i = 0; i < minerCount; i++) {
                remoteMiner.createRemoteMinerTask(invasion.sourceRoom, targetRoomName);
            }
            
            for(let i = 0; i < haulerCount; i++) {
                remoteHauler.createRemoteHaulerTask(invasion.sourceRoom, targetRoomName);
            }
        }
        
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
        console.log(`已禁用对 ${targetRoomName} 的远程采矿`);
        return true;
    }
};

module.exports = invasionManager; 