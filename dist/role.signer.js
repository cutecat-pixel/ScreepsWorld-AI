/**
 * 签名者角色模块
 * 负责前往目标房间，给房间控制器签名，然后自杀
 */
const roleSigner = {
    /**
     * Signer的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 如果没有目标房间或消息，自杀
        if(!creep.memory.targetRoom || !creep.memory.signText) {
            console.log(`签名者 ${creep.name} 缺少目标房间或签名文本，自杀`);
            creep.suicide();
            return;
        }
        
        // 如果不在目标房间，前往目标房间
        if(creep.room.name !== creep.memory.targetRoom) {
            const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            
            creep.moveTo(exit, {
                visualizePathStyle: {stroke: '#ffaa00'},
                reusePath: 50
            });
            creep.say('🚶前往');
            return;
        }
        
        // 已经在目标房间，尝试签名
        if(creep.room.controller) {
            const result = creep.signController(creep.room.controller, creep.memory.signText);
            
            if(result === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {
                    visualizePathStyle: {stroke: '#ffffff'},
                    reusePath: 20
                });
                creep.say('🖊️接近');
            }
            else if(result === OK) {
                // 签名成功，任务完成，自杀
                console.log(`签名者 ${creep.name} 已成功在房间 ${creep.room.name} 签名: "${creep.memory.signText}"`);
                creep.say('✓完成');
                creep.suicide();
            }
            else {
                // 其他错误情况，也自杀
                console.log(`签名者 ${creep.name} 签名失败，错误码: ${result}`);
                creep.suicide();
            }
        }
        else {
            // 如果房间没有控制器，任务无法完成，自杀
            console.log(`签名者 ${creep.name} 无法在房间 ${creep.room.name} 找到控制器，自杀`);
            creep.suicide();
        }
    },
    
    /**
     * 获取签名者的身体部件配置
     * @returns {Array} - 身体部件数组
     */
    getBody: function() {
        // 签名者只需要移动部件
        return [MOVE];
    },
    
    /**
     * 创建签名任务
     * @param {string} spawnRoomName - 出生房间名称
     * @param {string} targetRoomName - 目标房间名称
     * @param {string} signText - 签名文本
     */
    createSignerTask: function(spawnRoomName, targetRoomName, signText) {
        // 确保有生成队列
        if(!Memory.spawnQueue) {
            Memory.spawnQueue = {};
        }
        
        if(!Memory.spawnQueue[spawnRoomName]) {
            Memory.spawnQueue[spawnRoomName] = [];
        }
        
        // 添加到生成队列，高优先级
        Memory.spawnQueue[spawnRoomName].push({
            role: 'signer',
            priority: 1,
            memory: {
                role: 'signer',
                homeRoom: spawnRoomName,
                targetRoom: targetRoomName,
                signText: signText
            }
        });
        
        console.log(`已添加签名任务: 从 ${spawnRoomName} 派出签名者至 ${targetRoomName}, 文本: "${signText}"`);
        return `签名任务已添加到队列，签名文本: "${signText}"`;
    }
};

module.exports = roleSigner; 