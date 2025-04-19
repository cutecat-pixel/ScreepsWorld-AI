/**
 * 内存管理器
 * 负责清理和维护游戏内存数据
 */
const memoryManager = {
    /**
     * 内存管理器主方法，在主循环中调用
     */
    run: function() {
        this.cleanupMemory();
    },

    /**
     * 清理不存在的creeps的内存
     */
    cleanupMemory: function() {
        // 清理已经不存在的creeps内存
        for(let name in Memory.creeps) {
            if(!Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log('清理不存在的creep内存:', name);
            }
        }
        
        // 如果是新的一天，进行更多的内存清理
        this.periodicCleanup();
    },
    
    /**
     * 定期清理不必要的内存数据
     */
    periodicCleanup: function() {
        // 添加跨房间数据清理
        _.forIn(Memory.creeps, (mem, name) => {
            if(!Game.creeps[name] && Game.time - mem.lastSeen > 100) {
                delete Memory.creeps[name];
            }
        });
        
        // 压缩路径缓存
        if(Game.time % 100 === 0){
            PathFinder.costMatrixSerialize = () => '';
        }
        
        // 获取当前游戏tick
        const currentTick = Game.time;
        
        // 每10000个tick执行一次完整清理
        if(currentTick % 10000 === 0) {
            console.log('执行定期内存清理...');
            
            // 清理旧的房间数据
            if(Memory.roomData) {
                for(let roomName in Memory.roomData) {
                    // 如果这个房间不再可见或者数据太旧，移除它
                    if(!Game.rooms[roomName] || 
                       (Memory.roomData[roomName].lastUpdate && 
                        currentTick - Memory.roomData[roomName].lastUpdate > 20000)) {
                        delete Memory.roomData[roomName];
                        console.log(`删除过期的房间数据: ${roomName}`);
                    }
                }
            }
            
            // 清理其他过期数据...
        }
    },
    
    /**
     * 显示游戏资源和状态统计
     */
    reportStats: function() {
        // 初始化计数器
        let totalCreeps = 0;
        let creepsByRole = {};
        let totalEnergy = 0;
        let totalCapacity = 0;
        let roomsControlled = 0;
        
        // 统计所有房间的数据
        for(let name in Game.rooms) {
            const room = Game.rooms[name];
            
            if(room.controller && room.controller.my) {
                roomsControlled++;
                
                // 更新房间数据
                if(!Memory.roomData) Memory.roomData = {};
                if(!Memory.roomData[room.name]) Memory.roomData[room.name] = {};
                
                Memory.roomData[room.name].lastUpdate = Game.time;
                Memory.roomData[room.name].controllerLevel = room.controller.level;
                Memory.roomData[room.name].controllerProgress = room.controller.progress;
                Memory.roomData[room.name].controllerNeeded = room.controller.progressTotal;
                
                // 计算能量
                totalEnergy += room.energyAvailable;
                totalCapacity += room.energyCapacityAvailable;
            }
        }
        
        // 统计creep数量
        for(let name in Game.creeps) {
            totalCreeps++;
            const role = Game.creeps[name].memory.role || 'unknown';
            
            if(!creepsByRole[role]) {
                creepsByRole[role] = 1;
            } else {
                creepsByRole[role]++;
            }
        }
        
        // 输出统计信息
        console.log(`状态报告 [Tick: ${Game.time}]:`);
        console.log(`控制的房间: ${roomsControlled}`);
        console.log(`总能量: ${totalEnergy}/${totalCapacity} (${Math.round(totalEnergy/totalCapacity*100)}%)`);
        console.log(`Creeps总数: ${totalCreeps}`);
        
        // 输出每种角色的数量
        for(let role in creepsByRole) {
            console.log(`- ${role}: ${creepsByRole[role]}`);
        }
        
        // 报告CPU使用情况
        console.log(`CPU 使用: ${Game.cpu.getUsed().toFixed(2)}/${Game.cpu.limit} (${Math.round(Game.cpu.getUsed()/Game.cpu.limit*100)}%)`);
        console.log(`内存使用: ${(RawMemory.get().length/1000).toFixed(2)} KB`);
    }
};

module.exports = memoryManager; 