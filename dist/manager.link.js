/**
 * LINK管理器
 * 负责控制LINK之间的能量传输，尤其是从STORAGE附近的LINK到控制器附近的LINK
 */
const linkManager = {
    /**
     * 初始化LINK管理器
     * 在Memory中设置LINK的角色和位置
     * @param {Room} room - 房间对象
     */
    initLinks: function(room) {
        // 如果房间没有Memory中的links数据，创建一个
        if(!room.memory.links) {
            room.memory.links = {
                storage: null,
                controller: null,
                sources: []
            };

            // 查找房间中的所有LINK
            const links = room.find(FIND_MY_STRUCTURES, {
                filter: {structureType: STRUCTURE_LINK}
            });

            // 判断并设置LINK角色
            for(let link of links) {
                // 判断LINK是否靠近STORAGE
                const nearbyStorage = link.pos.findInRange(FIND_STRUCTURES, 3, {
                    filter: {structureType: STRUCTURE_STORAGE}
                });

                if(nearbyStorage.length > 0) {
                    room.memory.links.storage = link.id;
                    continue;
                }

                // 判断LINK是否靠近控制器
                if(link.pos.inRangeTo(room.controller.pos, 4)) {
                    room.memory.links.controller = link.id;
                    continue;
                }

                // 判断LINK是否靠近能量源
                const nearbySources = link.pos.findInRange(FIND_SOURCES, 3);
                if(nearbySources.length > 0) {
                    room.memory.links.sources.push(link.id);
                }
            }
        }
    },

    /**
     * 手动重新初始化房间的LINK配置
     * 用于LINK布局变更或需要重新设置LINK角色时
     * @param {string} roomName - 房间名称
     * @returns {string} - 初始化结果信息
     */
    manualInitLinks: function(roomName) {
        const room = Game.rooms[roomName];

        // 检查房间是否存在
        if(!room) {
            return `错误: 无法访问房间 ${roomName}`;
        }

        // 检查房间是否有控制器且属于玩家
        if(!room.controller || !room.controller.my) {
            return `错误: 房间 ${roomName} 不属于您或没有控制器`;
        }

        // 清除现有的links配置
        if(room.memory.links) {
            delete room.memory.links;
        }

        // 重新初始化links
        this.initLinks(room);

        // 获取初始化后的配置信息
        const linksConfig = room.memory.links;
        let result = `房间 ${roomName} 的LINK配置已重新初始化:\n`;

        if(linksConfig.storage) {
            result += `- Storage LINK: ${linksConfig.storage}\n`;
        } else {
            result += `- 未找到Storage LINK\n`;
        }

        if(linksConfig.controller) {
            result += `- Controller LINK: ${linksConfig.controller}\n`;
        } else {
            result += `- 未找到Controller LINK\n`;
        }

        result += `- Source LINKs (${linksConfig.sources.length}): ${linksConfig.sources.join(', ')}`;

        return result;
    },

    /**
     * 管理房间中的LINK能量传输
     * @param {Room} room - 房间对象
     */
    manageLinks: function(room) {
        // 检查控制器等级和是否有LINK结构
        if(room.controller.level < 5 || room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_LINK}}).length === 0) return;

        // 确保links内存对象存在
        if(!room.memory.links) {
            this.initLinks(room);
            return;
        }

        // 检查是否初始化过LINK
        if(!room.memory.links.storage && !room.memory.links.controller) {
            this.initLinks(room);
            return;
        }

        // 获取STORAGE旁边的LINK和控制器旁边的LINK
        const storageLink = Game.getObjectById(room.memory.links.storage);
        const controllerLink = Game.getObjectById(room.memory.links.controller);

        // 如果没有这两个关键LINK，返回
        if(!storageLink || !controllerLink) return;

        // 如果控制器旁的LINK能量不足，且STORAGE旁的LINK能量充足，传输能量
        if(controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) < 200 &&
           storageLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 600 &&
           !storageLink.cooldown) {
            storageLink.transferEnergy(controllerLink);
        }

        // 管理能源旁的LINK（将能量发送到STORAGE旁的LINK）
        if(room.memory.links.sources.length > 0) {
            for(let sourceLinkId of room.memory.links.sources) {
                const sourceLink = Game.getObjectById(sourceLinkId);
                if(sourceLink &&
                   sourceLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 700 &&
                   !sourceLink.cooldown &&
                   storageLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                    sourceLink.transferEnergy(storageLink);
                }
            }
        }
    }
};

// Add this line at the end of the file, before module.exports
global.linkManager = linkManager;

module.exports = linkManager;
