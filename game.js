import $ from 'jquery'

var game = {
    isEnd: false,
    canvas: document.getElementById("canvas"),
    ctx: document.getElementById("canvas").getContext("2d"),
    cellCount: 10,  //九宫格
    cellWidth: 32,  //方格大小
    lineCount: 5,
    mode: 7,
    actions: {},
    // TODO：待看
    play: function (name, action, interval) {
        var me = this;
        this.actions[name] = setInterval(function () {
            action();
            me.draw();
        }, interval || 50);
    },
    // TODO：待看
    stop: function (name) {
        clearInterval(this.actions[name]);
        this.draw();
    },
    colors: ['#009688', '#F44336', '#2196F3', '#9C27B0', '#673AB7', '#3F51B5', '#00BCD4',  '#FF9800', '#795548', '#CDDC39', '#9E9E9E'],

    // 这里是程序的起点
    // everything from here
    start: function (config = {}) {
        this.isEnd = false
        const body = $('body')
        this.cellCount = (!isNaN(config.cellCount) && config.cellCount >=5) ? config.cellCount : 10
        this.mode = config.mode || 7
        this.height = body.height()
        this.width = body.width()
        const max = body.width() > body.height() ? body.height() : body.width()
        this.cellWidth = parseInt((max - 200) / this.cellCount)
        this.cellWidth = this.cellWidth < 10 ? 10 : this.cellWidth

        this.ctx.clearRect(0, 0, 99999, 99999);
        this.map.init();
        this.ready.init();
        this.score.init()
        // this.draw();    // 这个其实不在此处执行也行的，因为 ready.flyin 动画的每一帧都会 调用 this.draw 一次
        this.canvas.onclick = this.onclick;
    },
    over: function () {
        this.isEnd = true
        if (window.app) {
            window.app.$emit('gameEnd', this.score.score)
        }
    },
    draw: function () {
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clearRect
        this.ctx.clearRect(0, 0, this.width, this.height);
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/save
        this.ctx.save();
        this.map.draw();
        this.ready.draw();
        this.score.draw();
        this.ctx.restore();
    },
    clicked: null,
    isMoving: function () {
        log(this.ready.isMoving, this.map.isMoving)
        return this.ready.isMoving || this.map.isMoving;
    },
    // 棋盘点击处理
    onclick: function (e) {
        if (this.isEnd) return
        if (game.isMoving()) {
            return;
        }
        var ratio = 1
        // 点击坐标
        var px = (e.offsetX || (e.clientX - game.canvas.offsetLeft)) - game.map.startX * ratio;
        var py = (e.offsetY || (e.clientY - game.canvas.offsetTop)) - game.map.startY * ratio;
        if (px < 0 || py < 0 || px > game.map.width * ratio || py > game.map.height * ratio) {
            return;
        }
        // 获取被点击的格子坐标
        var x = parseInt(px / (game.cellWidth * ratio));
        var y = parseInt(py / (game.cellWidth * ratio));
        var clicked = game.clicked;
        // 获取被点击的棋子
        var bubble = game.map.getBubble(x, y);
        if (bubble.color) {
            if (clicked) {
                //同一个棋子不做反映
                if (clicked.x == x && clicked.y == y) {
                    return;
                }
                clicked.stop();
            }
            // 重新选择一颗棋子
            clicked = game.clicked = bubble;
            bubble.play();
        }
        else {
            if (clicked) {
                clicked.stop();
                //移动被点击的棋子到目的地
                // bubble 是棋盘上的无色棋子
                // clicked 是有色棋子
                game.map.move(clicked, bubble);
            }
        }
        //log("x:" + x + " y:" + y);
    },
    getRandom: function (max) {
        return parseInt(Math.random() * 1000000 % (max));
    },
};

/**
 * 计分板
 * @type {{basic: number, operate: number, star1: number, star2: number, boom: number, draw: game.score.draw, addScore: game.score.addScore}}
 */
game.score = {

    init () {
        this.basic = 0
        this.operate = 0
        this.star1 = 0
        this.star2 = 0
        this.boom = 0
        this.score = 0
    },

    draw: function () {
        var startX = game.cellWidth * 10 + game.map.startX + 20;
        var startY = game.cellWidth * 2;
        var ctx = game.ctx;
        ctx.save();

        ctx.translate(startX, startY);
        ctx.clearRect(0, 0, 150, 400);
        ctx.strokeStyle = "#456";
        //ctx.strokeRect(0, 0, 150, 200);
        ctx.font = "24px 微软雅黑";
        ctx.fillStyle = "transparent";
        // 这里有算分规则
        this.score = this.basic * 5 + this.star1 * 8 + this.star2 * 10 + this.boom * 20
        if (window.app) {
            window.app.$emit('updateScore', this.score)
        }

        ctx.fillText("得分: " + this.score, 0, 30);
        ctx.stroke();
        ctx.restore();
    },
    // 计分
    addScore: function (length) {
        switch (length) {
            case 5:
                this.basic++;
                break;
            case 6:
                this.star1++;
                break;
            case 7:
                this.star2++;
                break;
            default:
                this.boom++;
                break;
        }
        this.draw();
    },
};

/**
 * 这是左上角的棋盒
 * @type {{startX: number, startY: number, width: number, height: number, bubbles: Array, init: game.ready.init, genrate: game.ready.genrate, draw: game.ready.draw, isMoving: boolean, flyin: game.ready.flyin}}
 */
game.ready = {
    /**
     * 初始化
     *      1、生成三枚棋子
     *      2、三枚棋子飞入棋盘随机位置
     */
    init: function () {
        this.isMoving = false
        this.startX = 41.5
        this.startY = 21.5
        this.bubbles = []
        this.width = game.cellWidth * 3;
        this.height = game.cellWidth;
        this.genrate();
        var me = this;
        me.flyin();
    },
    /**
     * 随机生成3枚待使用的棋子
     */
    genrate: function () {
        // 并向这三枚棋子附色
        for (var i = 0; i < 3; i++) {
            // game.mode 默认值：7
            // 随机取一种颜色
            var color = game.colors[game.getRandom(game.mode)];
            this.bubbles.push(new Bubble(i, 0, color));
        }
        //log(this.bubbles);
    },
    /**
     * 绘制棋盒
     */
    draw: function () {
        var ctx = game.ctx;
        ctx.save();
        // 移动棋盒到指定位置
        ctx.translate(this.startX, this.startY);
        ctx.beginPath();
        ctx.strokeStyle = "#555";
        ctx.strokeRect(0, 0, this.width, this.height);
        ctx.stroke();
        //绘制准备的棋子
        this.bubbles.forEach(function (bubble) {
            bubble.draw();
        });

        ctx.restore();
    },

    /**
     * 棋盒中取三枚棋子到棋盘
     */
    flyin: function () {
        var emptys = game.map.getEmptyBubbles();
        // 如果剩下的空间不够放3枚棋子，则游戏结束
        if (emptys.length < 3) {
            //GAME OVER
            game.over();
            return;
        }
        var me = this;
        var status = [0, 0, 0];
        var times = 1;
        // 新棋子落入棋盘
        // game 会在 action 后执行一次 draw 方法
        game.play("flyin", function () {
            // 如果三枚棋子都安稳地落入棋盘
            // 则棋盒中添加三枚棋子
            if (status[0] && status[1] && status[2]) {
                // 停止动画
                game.stop("flyin");
                me.isMoving = false;
                status = [0, 0, 0];
                me.bubbles = [];
                me.genrate();
                return;
            }
            // log(status)
            // 这是一个状态值，当前是否有棋子在移动
            me.isMoving = true;
            for (var i = 0; i < me.bubbles.length; i++) {
                if (status[i]) {
                    continue;
                }
                var target = emptys[i];
                // 棋子移动的的终点（相对于整个画布）
                var x2 = target.px + game.map.startX - me.startX;
                var y2 = target.py + game.map.startY - me.startY;
                var current = me.bubbles[i];
                // 每次移动剩下距离的 1/10
                var step = Math.abs(x2 - current.px)/10 || Math.abs(y2 - current.y)/10;
                // 如果棋子在目标点左侧
                if (current.px < x2) {
                    // y 轴上的移动也是如此
                    current.py = ((y2 - current.py) / (x2 - current.px)) * step + current.py;
                    current.px += step;
                    // 这是坐标纠正措施
                    if (current.px > x2) {
                        current.px = x2;
                    }
                }
                // 如果棋子在目标点右侧
                else if (current.px > x2) {
                    current.py = ((y2 - current.py) / (current.px - x2)) * step + current.py;
                    current.px -= step;
                    if (current.px < x2) {
                        current.px = x2;
                    }
                }
                // 如果在同一条垂直线上，则只需在 y 轴上移动
                else {
                    current.py += step;
                }
                if (current.py > y2) {
                    current.py = y2;
                }
                let limit = 0.05 * game.cellWidth
                limit = limit < 1 ? 1 : limit

                if (i === 0) log(i, '::::', current, x2, y2, limit)
                // 如果最后距离终点只有 0.1px ，则算作已经移动到终点
                if (Math.abs(current.px - x2) < limit && Math.abs(current.py - y2) < limit) {
                    status[i] = 1;
                    current.x = target.x;
                    current.y = target.y;
                    // 在棋盘上添加一枚棋子
                    game.map.addBubble(current);
                    // 移动到终点后会判断是否形成连珠
                    game.map.clearLine(current.x, current.y, current.color, false);
                }
            }
        }, 16);

    }
};
// 初始棋盘
game.map = {
    init: function () {
        this.startX = 40
        this.bubbles = []
        this.width = game.cellCount * game.cellWidth
        this.height = game.cellCount * game.cellWidth
        this.startY = game.cellWidth * 2  //棋盘Y坐标


        for (var i = 0; i < game.cellCount; i++) {
            var row = [];
            for (var j = 0; j < game.cellCount; j++) {
                row.push(new Bubble(j, i, null));
            }
            this.bubbles.push(row);
        }
    },

    /**
     * 清空穿过这个点的所有五子连线
     * @param x1    bubble.x
     * @param y1    bubble.y
     * @param color bubble.color
     * @param isClick
     */
    clearLine: function (x1, y1, color, isClick) {
        if (this.isEmpty(x1, y1)) {
            if (isClick) game.ready.flyin();
            return;
        };
        //给定一个坐标，看是否有满足的line可以被消除
        //4根线 一  | / \
        //横线
        var current = this.getBubble(x1, y1);
        if (!current.color) {
            log(current);
        }
        var arr1, arr2, arr3, arr4;
        // ——
        arr1 = this.bubbles[y1];
        // |
        arr2 = [];
        for (var y = 0; y < game.cellCount; y++)
            arr2.push(this.getBubble(x1, y));
        // \
        arr3 = [current];
        // /
        arr4 = [current];
        for (var i = 1; i < game.cellCount ; i++) {
            // 左上角连线上的点
            if (x1 - i >= 0 && y1 - i >= 0)
                arr3.unshift(this.getBubble(x1 - i, y1 - i));
            // 右下角连线上的点
            if (x1 + i < game.cellCount && y1 + i < game.cellCount)
                arr3.push(this.getBubble(x1 + i, y1 + i));
            // 左下角连线上的点
            if (x1 - i >= 0 && y1 + i < game.cellCount)
                arr4.push(this.getBubble(x1 - i, y1 + i));
            // 右下角连线上的点
            if (x1 + i < game.cellCount && y1 - i >= 0)
                arr4.unshift(this.getBubble(x1 + i, y1 - i));
        }
        var line1 = getLine(arr1);
        var line2 = getLine(arr2);
        var line3 = getLine(arr3);
        var line4 = getLine(arr4);
        var line = line1.concat(line2).concat(line3).concat(line4);

        // 动画执行时不干其他的事
        if (line.length < 5) {
            if (isClick) game.ready.flyin();
            return;
        }
        else {
            var me = this;
            var i = 0;

            // 我们要一颗一颗地删除连在一起的棋子
            game.play("clearline", function () {
                if (i == line.length) {

                    game.score.addScore(line.length);
                    game.stop("clearline");

                    me.isMoving = false;
                    // game.ready.flyin();
                    return;
                }
                me.isMoving = true;
                var p = line[i];
                // 这里仅仅是更新下 bubble 的配色参数，其实此时并不会有 UI 上的变化
                me.setBubble(p.x, p.y, null);
                i++;
            }, 200);
        }
        function getLine(bubbles) {

            var line = [];
            for (var i = 0; i < bubbles.length; i++) {
                var b = bubbles[i];
                if (b.color == color) {
                    line.push({ "x": b.x, "y": b.y });
                }
                else {
                    // 小于 5 个连珠则返回
                    if (line.length < 5)
                        line = [];
                    // 尽可能匹配多的连珠
                    else
                        return line;
                }
            }
            // 如果 bubbles 数组中的连珠都同色，但是小于 5，则前面不会 return
            // 所以在这里判断下
            if (line.length < 5)
                return [];
            return line;
        }
    },
    /**
     * 绘制棋盘以及棋盘上的（看不见）棋子
     */
    draw: function () {
        var ctx = game.ctx;
        // 保留之前的绘制
        ctx.save();
        // 棋盘的位置
        ctx.translate(this.startX, this.startY);
        // 开始画格子
        ctx.beginPath();
        for (var i = 0; i <= game.cellCount; i++) {
            // 从上往下 ---- 横着画
            var p1 = i * game.cellWidth;;
            ctx.moveTo(p1, 0);
            ctx.lineTo(p1, this.height);
            // 从左往右 | 竖着画
            var p2 = i * game.cellWidth;
            ctx.moveTo(0, p2);
            ctx.lineTo(this.width, p2);
        }
        // 设置填充色
        ctx.strokeStyle = "#555";
        // 画完格子啦
        ctx.stroke();
        //绘制子元素（所有在棋盘上的棋子）
        this.bubbles.forEach(function (row) {
            row.forEach(function (bubble) {
                bubble.draw();
            });
        });
        // 恢复之前缓存的数据
        ctx.restore();
    },
    isMoving: false,

    // 将一枚棋子移动到指定地方
    move: function (bubble, target) {
        var path = this.search(bubble.x, bubble.y, target.x, target.y);
        // 注意：这条路径是反向操作！！
        if (!path) {
            //显示不能移动s
            //alert("过不去");
            return;
        }

        //map开始播放当前棋子的移动效果
        //两种实现方式，1、map按路径染色，最后达到目的地 2、map生成一个临时的bubble负责展示，到目的地后移除
        //log(path);
        var me = this;
        var name = "move_" + bubble.x + "_" + bubble.y;
        var i = path.length - 1;
        var color = bubble.color;
        game.play(name, function () {
            if (i < 0) {
                game.stop(name);
                game.clicked = null;
                me.isMoving = false;
                me.clearLine(target.x, target.y, color, true);
                return;
            }
            me.isMoving = true;
            path.forEach(function (cell) {
                me.setBubble(cell.x, cell.y, null);
            });
            var currentCell = path[i];
            me.setBubble(currentCell.x, currentCell.y, color);
            i--;
        }, 30);
    },

    // 光说不行，我们得找一条路吧？
    // 这里查找从 1 到 2 的路径
    // 这并不是最短路径算法
    search: function (x1, y1, x2, y2) {
        var history = [];
        var goalCell = null;
        var me = this;
        getCell(x1, y1, null);
        // 如果从起点出发，能到达目标点
        if (goalCell) {
            var path = [];

            var cell = goalCell;
            while (cell) {
                path.push({ "x": cell.x, "y": cell.y });
                cell = cell.parent;
            }
            return path;
        }
        return null;

        // 获取所有相邻的格子的权重
        // 这块怎么解释呢？一次只能跨一个格子，那么找到所有从 A 点出发后能到达的点
        function getCell(x, y, parent) {
            if (goalCell) return // NOTICE: 这是新增的优化方式
            // 这里的bubbles存的是列和行数
            if (x >= me.bubbles.length || y >= me.bubbles.length)
                return;

            if (x != x1 && y != y2 && !me.isEmpty(x, y))
                return;

            // 如果是一个跑过的格子，则忽略
            for (var i = 0; i < history.length; i++) {
                if (history[i].x == x && history[i].y == y)
                    return;
            }
            var cell = { "x": x, "y": y, child: [], "parent": parent };
            // 终点也会被放到 history 中
            // 也就是，如果已经找到路线，那么不会有第二条路线
            // 因为终点已经被这条路线占用了
            // 因此有个可以优化的点就是：如果 goalcell 已经存在，则不再继续找路线
            history.push(cell);

            // 如果已经到达终点，那咱就不说啥了
            if (cell.x == x2 && cell.y == y2) {
                goalCell = cell;
                return cell;
            }
            var child = [];
            var left, top, right, buttom;
            //最短路径的粗略判断就是首选目标位置的大致方向
            // 当前cell的四个方向有哪些可选路径
            if (x - 1 >= 0 && me.isEmpty(x - 1, y))
                child.push({ "x": x - 1, "y": y });
            if (x + 1 < me.bubbles.length && me.isEmpty(x + 1, y))
                child.push({ "x": x + 1, "y": y });
            if (y + 1 < me.bubbles.length && me.isEmpty(x, y + 1))
                child.push({ "x": x, "y": y + 1 });
            if (y - 1 >= 0 && me.isEmpty(x, y - 1))
                child.push({ "x": x, "y": y - 1 });
            var distance = [];
            for(var i=0;i<child.length;i++){
                var c = child[i];
                if(c){
                    // 权值的计算方式 x 轴和 y 轴的距离之和
                    distance.push({"i":i,"d":Math.abs(x2 - c.x) + Math.abs(y2 - c.y)});
                }else{
                    // 这块不会执行的
                    alert('这块不会执行的')
                    distance.push({"i":i,"d":-1});
                }
            };
            // 这里根据权值排下序
            distance.sort(function (a, b) { return a.d - b.d });

            for (var i = 0; i < child.length; i++) {
                var d = distance[i];
                var c = child[d.i];
                if (c) cell.child.push(getCell(c.x, c.y, cell));
            }

            return cell;
        }
    },
    // 获取空的棋子落框 TODO：这个暂时还不确定是否只是放置一枚棋子的盒子
    getEmptyBubbles: function () {
        var empties = [];
        this.bubbles.forEach(function (row) {
            row.forEach(function (bubble) {
                if (!bubble.color) {
                    empties.push(new Bubble(bubble.x, bubble.y));
                }
            });
        });
        if (empties.length <= 3) {
            return [];
        }
        var result = [];
        var useds = [];
        for (var i = 0; i < empties.length; i++) {
            if (result.length == 3) {
                break;
            }
            var isUsed = false;
            var ra = game.getRandom(empties.length);
            for (var m = 0; m < useds.length; m++) {
                isUsed = ra === useds[m];
                if (isUsed) break;
            }
            if (!isUsed) {
                result.push(empties[ra]);
                useds.push(ra);
            }
        }
        //log(useds);
        return result;
    },

    addBubble: function (bubble) {
        var thisBubble = this.getBubble(bubble.x, bubble.y);
        thisBubble.color = bubble.color;
    },

    setBubble: function (x, y, color) {
        this.getBubble(x, y).color = color;
    },

    getBubble: function (x, y) {
        if (x < 0 || y < 0 || x > game.cellCount || y > game.cellCount) return null;
        return this.bubbles[y][x];
    },
    isEmpty: function (x, y) {
        var bubble = this.getBubble(x, y);
        return !bubble.color;
    },
};
var Cell = function (x, y) {
    this.x = x;
    this.y = y;

}
window.count = 0
var Bubble = function (x, y, color) {
    this.x = x;     // 几行几列
    this.y = y;
    // 这个地址是相对棋盘左上角而言
    // 所以如果要获取相对于整个画布的位置，则需要加上 map.startX map.startY 的坐标
    this.px = game.cellWidth * this.x + game.cellWidth / 2;   // 像素中心点
    this.py = game.cellWidth * this.y + game.cellWidth / 2;
    this.color = color;
    this.width = parseInt(game.cellWidth / 2)
    this.light = this.width / 1.4;
};
Bubble.prototype.draw = function () {
    if (!this.color) {
        return;
    }
    // console.log('draw')
    var ctx = game.ctx;
    ctx.beginPath();
    //log("x:" + px + "y:" + py);
    // 创建环形渐变

    var gradient = ctx.createRadialGradient(this.px - 0, this.py - 0, 0, this.px, this.py, this.light);
    gradient.addColorStop(0, 'rgba(255,255,255, 1)');
    gradient.addColorStop(1, this.color);
    // 画一个圆形棋子
    ctx.arc(this.px, this.py, this.width / 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.stroke();
};
/**
 * 棋子开始闪烁
 */
Bubble.prototype.play = function () {
    var me = this;
    var isUp = true;
    game.play("light_" + this.x + "_" + this.y, function () {
        if (isUp) {
            me.light *= 1.2;
        }
        if (!isUp) {
            me.light *= 0.8;
        }
        if (me.light >= me.width * 3) {
            isUp = false;
        }
        if (me.light <= me.width) {
            isUp = true;
        }
    }, 50);
};
/**
 * 棋子结束闪烁
 */
Bubble.prototype.stop = function () {
    //this.light = 10;
    var me = this;
    game.stop("light_" + this.x + "_" + this.y);

    // 停止闪烁后如果棋子还是高亮状态
    // 则取消高亮
    game.play("restore_" + this.x + "_" + this.y, function () {
        if (me.light > 10) {
            me.light--;
        }
        else {
            me.light = 10;
            game.stop("restore_" + me.x + "_" + me.y);
        }
    }, 50);
};

function log(...arg) {
    console.log(...arg)
}

export default game;