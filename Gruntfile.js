module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');

    grunt.initConfig({
        screeps: {
            options: {
                email: process.env.SCREEPS_EMAIL || '你的邮箱',
                token: process.env.SCREEPS_TOKEN || '你的令牌',
                branch: process.env.SCREEPS_BRANCH || 'default',
                //server: 'season'
            },
            dist: {
                src: ['dist/*.js']
            }
        }
    });
}